

class BatteryItemInfo {

    bid; // Battery ID
    devtype; // Device type
    manufactoty; // Manufacturer name
    partno; // Part number
    model1sn; // Model 1 serial number
    model2sn; // Model 2 serial number
    model3sn; // Model 3 serial number
    model4sn; // Model 4 serial number
    model5sn; // Model 5 serial number
    model6sn; // Model 6 serial number
    model7sn; // Model 7 serial number
    model8sn; // Model 8 serial number
    modeltotal; // Total number of models
    monomertotoal; // Total number of monomers
    monomerinmodel; // Monomers per model
    ratedvoltage; // Rated voltage
    capacity; // Battery capacity
    hardwarever; // Hardware version
    softwarever; // Software version
    
    constructor( data ) {
        this.bid = data.bid;
        this.devtype = data.devtype;
        this.manufactoty = data.manufactoty;
        this.partno = data.partno;
        this.model1sn = data.model1sn;
        this.model2sn = data.model2sn;
        this.model3sn = data.model3sn;
        this.model4sn = data.model4sn;
        this.model5sn = data.model5sn;
        this.model6sn = data.model6sn;
        this.model7sn = data.model7sn;
        this.model8sn = data.model8sn;
        this.modeltotal = data.modeltotal;
        this.monomertotoal = data.monomertotoal;
        this.monomerinmodel = data.monomerinmodel;
        this.ratedvoltage = data.ratedvoltage;
        this.capacity = data.capacity;
        this.hardwarever = data.hardwarever;
        this.softwarever = data.softwarever;
    }
}

export default BatteryItemInfo