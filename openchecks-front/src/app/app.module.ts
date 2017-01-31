import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app.component';

import {DashboardService} from './dashboard/dashboard.service';

import {JqueryTabsIntegration} from './shared/jquerytabsintegration.component';
import {GoogleChartIntegration} from './shared/googlechartintegration.component';
import {DashboardPieChartComponent} from './dashboard/dashboardpiechart.component';
import {DashboardComponent} from './dashboard/dashboard.component';


@NgModule({
  declarations: [
    AppComponent, JqueryTabsIntegration, GoogleChartIntegration, DashboardPieChartComponent,
    DashboardComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule
  ],
  providers: [DashboardService],
  bootstrap: [AppComponent]
})
export class AppModule { }
