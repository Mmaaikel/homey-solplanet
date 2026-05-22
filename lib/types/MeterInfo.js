

class MeterInfo {

    mod; // Meter mode
    enb; // Meter enabled status
    exp_m; // Export mode
    regulate; // Regulation value
    enb_PF; // Power Factor enabled status
    target_PF; // Target Power Factor value
    total_pac; // Total active power in W
    total_fac; // Total frequency in 0.01 Hz
    meter_pac; // Meter power in W
    sn; // Meter serial number
    manufactory; // Manufacturer name
    type; // Meter type
    name; // Meter name
    model; // Meter model code
    abs; // Absolute value flag
    offset; // Offset value
    
    constructor( data ) {
        this.mod = data.mod;
        this.enb = data.enb;
        this.exp_m = data.exp_m;
        this.regulate = data.regulate;
        this.enb_PF = data.enb_PF;
        this.target_PF = data.target_PF;
        this.total_pac = data.total_pac;
        this.total_fac = data.total_fac;
        this.meter_pac = data.meter_pac;
        this.sn = data.sn;
        this.manufactory = data.manufactory;
        this.type = data.type;
        this.name = data.name;
        this.model = data.model;
        this.abs = data.abs;
        this.offset = data.offset;
    }
}

export default MeterInfo