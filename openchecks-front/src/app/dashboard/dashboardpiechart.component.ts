import { Component} from '@angular/core';
import { GoogleChartIntegration } from '../shared/googlechartintegration.component';
import {DashboardService} from './dashboard.service';

@Component({
  selector: 'piechart',
  template: `<div id="piechart_div"></div>`
})
export class DashboardPieChartComponent extends GoogleChartIntegration {
  private options;
  private data;
  private chart;
  
  constructor(private dashboardService: DashboardService){
    super();
  }

  drawChart() {
    let google = this.getGoogle();
    // Create the data table.
    let data = new google.visualization.DataTable();
    data.addColumn('string', 'Check Status');
    data.addColumn('number', 'Amount');
    
    // Set chart options
    this.options = {'title':'Check OCR Status','width':400, 'height':300};
        
    // Instantiate and draw our chart, passing in some options.
    this.chart = new google.visualization.PieChart(document.getElementById('piechart_div'));

    
    this.dashboardService.getRejectedChecks().subscribe(result => { 
      console.log("Drawing chart - rejected");
      console.log(result);
      console.log(data);
      let amount = result ? result.length : 0;
      data.addRows([
        ['Rejected', amount]
      ]);

      if (data.getNumberOfRows() === 2) this.chart.draw(data, this.options);
    });
    
    this.dashboardService.getParsedChecks().subscribe(result => { 
      console.log("Drawing chart - parsed");
      console.log(result);
      console.log(data);
      let amount = result ? result.length : 0;
      data.addRows([
        ['Parsed', amount]
      ]);

      if (data.getNumberOfRows() === 2) this.chart.draw(data, this.options);
    });
    
  }
}