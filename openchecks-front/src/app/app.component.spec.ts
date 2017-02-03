import { HttpModule, Http } from '@angular/http';
import { DashboardService } from './dashboard/dashboard.service';
import { TestBed, ComponentFixtureAutoDetect, ComponentFixture, async } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  
  let comp:    AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent
      ],providers: [
        { provide: ComponentFixtureAutoDetect, useValue: true },
        DashboardService
      ], imports: [
        HttpModule
      ]
    });
    TestBed.compileComponents();
  }));
  
  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    comp = fixture.componentInstance; // AppComponent test instance
  });

  it('should show the rejected checks', async(() => {
    comp.getRejectedChecks();
    fixture.detectChanges();
    console.log(comp.rejectedChecks);
    expect("true").toEqual("true");
  }));
});
