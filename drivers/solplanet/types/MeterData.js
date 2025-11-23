

class MeterData {

    flg; // Meter status flag
    tim; // Timestamp of data
    pac; // Grid power in W (positive: import, negative: export)
    itd; // Today's imported energy in 0.01 kWh
    otd; // Today's exported energy in 0.01 kWh
    iet; // Total imported energy in 0.1 kWh
    oet; // Total exported energy in 0.1 kWh
    mod; // Meter operating mode
    enb; // Meter enabled status
    
    constructor( data ) {
        this.flg = data.flg;
        this.tim = data.tim;
        this.pac = data.pac;
        this.itd = data.itd;
        this.otd = data.otd;
        this.iet = data.iet;
        this.oet = data.oet;
        this.mod = data.mod;
        this.enb = data.enb;
    }
}

export default MeterData