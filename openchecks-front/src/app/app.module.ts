import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule, JsonpModule } from '@angular/http';

import { AppComponent } from './app.component';

import {DashboardService} from './dashboard/dashboard.service';

import {JqueryTabsIntegration} from './shared/jquerytabsintegration.component';
import {GoogleChartIntegration} from './shared/googlechartintegration.component';
import {DashboardPieChartStatusesComponent} from './dashboard/dashboardpiechartstatuses.component';
import {DashboardPieChartAmountsComponent} from './dashboard/dashboardpiechartamounts.component';
import {DashboardComponent} from './dashboard/dashboard.component';


@NgModule({
  declarations: [
    AppComponent, JqueryTabsIntegration, GoogleChartIntegration, DashboardPieChartStatusesComponent,
    DashboardComponent, DashboardPieChartAmountsComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    JsonpModule
  ],
  providers: [DashboardService],
  bootstrap: [AppComponent]
})
export class AppModule { }
