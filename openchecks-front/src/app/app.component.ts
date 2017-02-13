import { Component } from '@angular/core';
import { DashboardService } from './dashboard/dashboard.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['app.component.css']
})
export class AppComponent {
  
  constructor(private dashboardService: DashboardService) {
    
  }
  
}