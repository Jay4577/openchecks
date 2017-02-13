export class CloudantCheckStatisticsRowMapping {
 
  constructor(public _id: string, public _rev: string, public totalCheques: number, public totalRejected: number, 
              public totalAccepted: number, public totalAmount: number, public totalAmountAccepted: number, 
              public totalAmountRejected: number, public calculatedFromHost: string) {
    
  }
}