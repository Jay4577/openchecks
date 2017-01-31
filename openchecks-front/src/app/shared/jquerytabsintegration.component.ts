import {Component, ElementRef, OnInit} from '@angular/core';

declare var jQuery:any;
@Component({
    selector: '.uitabs',
    template: `<ng-content></ng-content>`
})
export class JqueryTabsIntegration implements OnInit {
    elementRef: ElementRef;
    constructor(elementRef: ElementRef) {
        this.elementRef = elementRef;
    }
    ngOnInit() {
        jQuery(this.elementRef.nativeElement).tabs();
    }
}