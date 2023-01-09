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
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  repeat,
  retry,
  scan,
  startWith,
  Subject,
  Subscription,
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
  SecondDay = 'SecondDay',
}

type HTMLElementEvent = Event & { target: HTMLElement };

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
  private subscription: Subscription | undefined;

  @ViewChildren('day') daysOfTheMonth: QueryList<ElementRef<HTMLDivElement>> =
    new QueryList();

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

  addClassName(index: number, event: AccumulatorClick) {
    if (event.firstDayIndex === index) {
      return 'start';
    }

    if (
      index === event.secondDayIndex &&
      event.firstDayIndex !== event.secondDayIndex
    ) {
      return 'end';
    }

    if (
      this.days[event.firstDayIndex].getDate() < this.days[index].getDate() &&
      this.days[event.secondDayIndex].getDate() > this.days[index].getDate() &&
      this.days[index].getMonth() === this.date.getMonth()
    ) {
      return 'selected';
    }

    return 'remove';
  }

  onSelectedDate() {
    let clickEvent: Observable<HTMLElementEvent>[] = [];
    let mouseEnter: Observable<HTMLElementEvent>[] = [];

    this.daysOfTheMonth.forEach((element) => {
      clickEvent.push(fromEvent<HTMLElementEvent>(element.nativeElement, 'click'));
      mouseEnter.push(
        fromEvent<HTMLElementEvent>(element.nativeElement, 'mouseenter')
      );
    });

    this.subscription = merge(...clickEvent)
      .pipe(
        filter((event) => {
          return event.target.className !== 'offset';
        }),
        withLatestFrom(this.resetSelectedDays),
        scan(
          (acc: AccumulatorClick, [event, isResetSelectedDays]) => {
            const dayIndex = Number(event.target.getAttribute('index'));

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
            filter((event) => {
              return event.target.className !== 'offset';
            }),
            startWith(event),
            takeWhile((eventMouseEnter) => {
              if (eventMouseEnter instanceof Event) {
                const secondDayIndex = Number(
                  eventMouseEnter.target.getAttribute('index')
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
                    eventMouseEnter.target.getAttribute('index')
                  ),
                  selectedDay: event.selectedDay,
                };
              }
              return eventMouseEnter;
            })
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
        next: (event) => {
          if (!(event instanceof Observable)) {
            if (event.selectedDay == SelectedDay.SecondDay) {
              this.selectedDays.emit({
                startDay: this.days[event.firstDayIndex],
                endDay: this.days[event.secondDayIndex],
              });
            }

            this.daysOfTheMonth.forEach(
              (element, index) => {
                switch (this.addClassName(index, event)) {
                  case 'start': {
                    if (/selected|end/g.test(element.nativeElement.className)) {
                      this.renderer.removeClass(
                        element.nativeElement,
                        'selected'
                      );
                      this.renderer.removeClass(element.nativeElement, 'end');
                    }
                    this.renderer.addClass(element.nativeElement, 'start');
                    break;
                  }
                  case 'selected': {
                    if (/end/g.test(element.nativeElement.className)) {
                      this.renderer.removeClass(element.nativeElement, 'end');
                    }
                    this.renderer.addClass(element.nativeElement, 'selected');
                    break;
                  }
                  case 'end': {
                    if (/selected/g.test(element.nativeElement.className)) {
                      this.renderer.removeClass(
                        element.nativeElement,
                        'selected'
                      );
                    }
                    this.renderer.addClass(element.nativeElement, 'end');
                    break;
                  }
                  case 'remove': {
                    this.removeClass(element);
                  }
                }
              }
            );
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
        if (this.subscription) {
          this.subscription.unsubscribe();
        }
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
