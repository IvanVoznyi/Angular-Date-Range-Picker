import { Pipe, PipeTransform } from '@angular/core';
import { SelectedDays } from 'src/app/app.component';

@Pipe({
  standalone: true,
  name: 'datePickerClass',
})
export class DatePickerClassPipe implements PipeTransform {
  transform(
    day: Date,
    currentDate: Date,
    selectDays: SelectedDays | undefined
  ): string {
    let className = '';

    if (currentDate.getMonth() !== day.getMonth()) {
      className = 'offset';
    }

    if (currentDate.getMonth() === day.getMonth()) {
      className = 'day';
    }

    if (
      selectDays &&
      currentDate.getMonth() === selectDays.startDay.getMonth()
    ) {
      if (
        selectDays.startDay.getDate() === day.getDate() &&
        selectDays.startDay.getMonth() === day.getMonth() &&
        selectDays.startDay.getFullYear() === day.getFullYear()
      ) {
        className = 'day start';
      }
    }

    if (
      selectDays &&
      currentDate.getMonth() === selectDays.startDay.getMonth()
    ) {
      if (
        selectDays.endDay.getDate() === day.getDate() &&
        selectDays.endDay.getMonth() === day.getMonth() &&
        selectDays.endDay.getFullYear() === day.getFullYear()
      ) {
        className = 'day end';
      }
    }

    if (
      selectDays &&
      currentDate.getMonth() === selectDays.startDay.getMonth()
    ) {
      if (
        selectDays.startDay.getDate() < day.getDate() &&
        selectDays.endDay.getDate() > day.getDate() &&
        day.getMonth() === selectDays.endDay.getMonth() &&
        day.getFullYear() === selectDays.startDay.getFullYear()
      ) {
        className = 'day selected';
      }
    }

    return className;
  }
}
