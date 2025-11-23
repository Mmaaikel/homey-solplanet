import BatteryItemInfo from './BatteryItemInfo.js';

class BatteryInfo {

    type; // Battery system type
    mod_r; // Battery work mode
    battery; // Battery detail information
    isn; // Battery serial number
    stu_r; // Status register
    muf; // Manufacturer code
    mod; // Battery model code
    num; // Number of batteries
    fir_r; // Firmware register
    charging; // Charging status
    charge_max; // Max state of charge in %
    discharge_max; // Min state of charge in %
    
    constructor( data ) {
        this.type = data.type;
        this.mod_r = data.mod_r;
        this.isn = data.isn;
        this.stu_r = data.stu_r;
        this.muf = data.muf;
        this.mod = data.mod;
        this.num = data.num;
        this.fir_r = data.fir_r;
        this.charging = data.charging;
        this.charge_max = data.charge_max;
        this.discharge_max = data.discharge_max;
        this.battery = new BatteryItemInfo( data.battery )  ;
    }
}

export default BatteryInfo