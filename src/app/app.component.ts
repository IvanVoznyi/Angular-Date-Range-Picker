import { DatePipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  DatePickerComponent,
  StartWeek,
} from './date-picker/date-picker.component';

export interface SelectedDays {
  startDay: Date;
  endDay: Date;
}

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [NgIf, DatePipe, DatePickerComponent, ReactiveFormsModule],
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  protected selectedDays: SelectedDays | undefined;
  startWeek: StartWeek = StartWeek.Sun;
  form = new FormGroup({
    startWeek: new FormControl<StartWeek>(StartWeek.Sun),
  });

  onSelectedDays(days: SelectedDays) {
    this.selectedDays = days;
  }

  ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.startWeek = value.startWeek as StartWeek;
    });
  }
}
