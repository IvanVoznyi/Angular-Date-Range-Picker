import { DatePipe, NgClass, NgFor, SlicePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  Renderer2,
  SimpleChanges,
  ViewChildren,
} from '@angular/core';
import {
  BehaviorSubject,
  fromEvent,
  map,
  merge,
  Observable,
  repeat,
  retry,
  scan,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  takeWhile,
  throwError,
  withLatestFrom,
} from 'rxjs';
import { SelectedDays } from '../app.component';
import { DatePickerClassPipe } from './pipe/datepickerclass.pipe';

export enum StartWeek {
  Mon,
  Sun,
}

enum GenerateDatePickerType {
  NextMonth,
  PreviousMonth,
}

interface AccumulatorClick {
  selectedDay: SelectedDay;
  firstDayIndex: number;
  secondDayIndex: number;
}

enum SelectedDay {
  None = 'None',
  FirstDay = 'FirstDay',
  SecondDay = 'SecondDay'
}

@Component({
  standalone: true,
  selector: 'app-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  imports: [DatePipe, NgFor, NgClass, DatePickerClassPipe, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatePickerComponent
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  protected days: Array<Date> = [];
  protected date = new Date();
  protected untilDestroy = new Subject<void>();
  private resetSelectedDays = new BehaviorSubject<boolean>(false);

  @ViewChildren('day') daysOfTheMonth: QueryList<ElementRef> = new QueryList();

  @Input()
  selectDays: SelectedDays | undefined;

  @Input()
  startWeek: StartWeek = StartWeek.Sun;

  @Output()
  selectedDays = new EventEmitter<SelectedDays>();

  constructor(private renderer: Renderer2) {}

  generateNewDatePickerData(generateDatePicker: GenerateDatePickerType) {
    const month =
      generateDatePicker === GenerateDatePickerType.NextMonth
        ? this.date.getMonth() + 1
        : this.date.getMonth() - 1;
    this.date = new Date(this.date.setMonth(month));
    this.days = this.generateCalendar(this.date, this.startWeek);
  }

  previousMonth() {
    this.generateNewDatePickerData(GenerateDatePickerType.PreviousMonth);
  }

  nextMonth() {
    this.generateNewDatePickerData(GenerateDatePickerType.NextMonth);
  }

  generateCalendar = (date: Date, startWeek: StartWeek = StartWeek.Sun) => {
    const days = [];
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const lastDayInPreviousMonth = new Date(
      date.getFullYear(),
      date.getMonth(),
      0
    );
    const day = startWeek;
    const offset =
      this.startWeek === StartWeek.Sun && lastDayInPreviousMonth.getDay() == 6
        ? 1
        : -lastDayInPreviousMonth.getDay();

    for (let index = offset; index <= lastDay.getDate(); index++) {
      days.push(
        new Date(new Date(firstDay).setDate(firstDay.getDate() - day + index))
      );
    }

    return days;
  };

  dateTrackBy(index: number, date: Date) {
    return date.getDay();
  }

  private removeClass(item: ElementRef<HTMLElement>) {
    this.renderer.removeClass(item.nativeElement, 'selected');
    this.renderer.removeClass(item.nativeElement, 'start');
    this.renderer.removeClass(item.nativeElement, 'end');
  }

  onSelectedDate() {
    let clickEvent = this.daysOfTheMonth
      .filter((item: ElementRef<HTMLElement>) => {
        return item.nativeElement.className !== 'offset';
      })
      .map((t: ElementRef<HTMLElement>) => fromEvent(t.nativeElement, 'click'));

    let mouseEnter = this.daysOfTheMonth
      .filter((item: ElementRef<HTMLElement>) => {
        return item.nativeElement.className !== 'offset';
      })
      .map((t: ElementRef<HTMLElement>) =>
        fromEvent(t.nativeElement, 'mouseenter')
      );

    merge(...clickEvent)
      .pipe(
        withLatestFrom(this.resetSelectedDays),
        scan(
          (acc: AccumulatorClick, [event, isResetSelectedDays]) => {
            const dayIndex = Number(
              (event.target as HTMLElement).getAttribute('index')
            );

            if (
              dayIndex <= acc.firstDayIndex ||
              isResetSelectedDays ||
              acc.selectedDay === SelectedDay.SecondDay
            ) {
              acc.selectedDay = SelectedDay.None;
            }

            if (acc.selectedDay === SelectedDay.None) {
              acc.firstDayIndex = dayIndex;
              acc.secondDayIndex = dayIndex;
              acc.selectedDay = SelectedDay.FirstDay;
              this.resetSelectedDays.next(false);
            } else {
              acc.firstDayIndex = acc.firstDayIndex;
              acc.secondDayIndex = dayIndex;
              acc.selectedDay = SelectedDay.SecondDay;
            }

            return acc;
          },
          {
            selectedDay: SelectedDay.None,
            firstDayIndex: 0,
            secondDayIndex: 0,
          } as AccumulatorClick
        ),
        takeWhile((value) => {
          return value.selectedDay !== SelectedDay.SecondDay;
        }, true),
        switchMap((event) => {
          return merge(...mouseEnter).pipe(
            startWith(event),
            takeWhile((eventMouseEnter) => {
              if (eventMouseEnter instanceof Event) {
                const secondDayIndex = Number(
                  (eventMouseEnter.target as HTMLElement).getAttribute('index')
                );
                return event.firstDayIndex <= secondDayIndex;
              }
              return eventMouseEnter.selectedDay !== SelectedDay.SecondDay;
            }, true),
            map((eventMouseEnter) => {  
              if (eventMouseEnter instanceof Event) {
                return {
                  firstDayIndex: event.firstDayIndex,
                  secondDayIndex: Number(
                    (eventMouseEnter.target as HTMLElement).getAttribute(
                      'index'
                    )
                  ),
                  selectedDay: event.selectedDay,
                };
              }
              return eventMouseEnter;
            }),
          );
        }),
        map((event) => {
          if (event.secondDayIndex < event.firstDayIndex) {
            this.resetSelectedDays.next(true);
            return throwError(Error);
          }
          return event;
        }),
        retry(),
        repeat(),
        takeUntil(this.untilDestroy)
      )
      .subscribe({
        next: (event: any) => {
          if (!(event instanceof Observable)) {
            if (event.selectedDay !== SelectedDay.SecondDay) {
              this.daysOfTheMonth.forEach((item: ElementRef<HTMLElement>) => {
                this.removeClass(item);
              });
            }

            if (event.selectedDay == SelectedDay.SecondDay) {
              this.selectedDays.emit({
                startDay: this.days[event.firstDayIndex],
                endDay: this.days[event.secondDayIndex],
              });
            }

            this.renderer.addClass(
              this.daysOfTheMonth.get(event.firstDayIndex)!.nativeElement,
              'start'
            );
            this.renderer.addClass(
              this.daysOfTheMonth.get(event.secondDayIndex)!.nativeElement,
              'end'
            );

            this.daysOfTheMonth.forEach((element, index) => {
              if (
                this.days[event.firstDayIndex].getDate() <
                  this.days[index].getDate() &&
                this.days[event.secondDayIndex].getDate() >
                  this.days[index].getDate() &&
                this.days[index].getMonth() === this.date.getMonth()
              ) {
                this.renderer.addClass(element.nativeElement, 'selected');
              }
            });
          } else {
            this.daysOfTheMonth.forEach((item) => {
              this.removeClass(item);
            });
          }
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  ngAfterViewInit(): void {
    this.daysOfTheMonth.changes
      .pipe(takeUntil(this.untilDestroy))
      .subscribe(() => {
        this.onSelectedDate();
      });

    this.onSelectedDate();
  }

  ngOnInit(): void {
    this.days = this.generateCalendar(this.date, this.startWeek);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startWeek'] && !changes['startWeek'].firstChange) {
      this.days = this.generateCalendar(
        this.date,
        changes['startWeek'].currentValue
      );
    }
  }

  ngOnDestroy(): void {
    this.untilDestroy.next();
    this.untilDestroy.complete();
  }
}
