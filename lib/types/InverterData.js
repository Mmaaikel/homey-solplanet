

class InverterData {

    flg; // Inverter status code
    tim; // Timestamp of data
    tmp; // Inverter temperature in 0.1°C
    fac; // AC frequency in 0.01 Hz
    pac; // Total active power output in W
    sac; // Total apparent power in VA
    qac; // Total reactive power in VAr
    eto; // Total energy production in 0.1 kWh # codespell:ignore eto
    etd; // Today's energy production in 0.1 kWh
    hto; // Total working hours in h
    pf; // Power factor in 0.01
    wan; // Warning code
    err; // Error code
    vac; // AC phase voltages in 0.1 V
    iac; // AC phase currents in 0.1 A
    vpv; // PV input voltages per MPPT in 0.1 V
    ipv; // PV input currents per MPPT in 0.01 A
    str; // String values
    stu; // Status value
    pac1; // Phase 1 active power in W
    qac1; // Phase 1 reactive power in VAr
    pac2; // Phase 2 active power in W
    qac2; // Phase 2 reactive power in VAr
    pac3; // Phase 3 active power in W
    qac3; // Phase 3 reactive power in VAr

    constructor( data ) {
        this.flg = data.flg;
        this.tim = data.tim;
        this.tmp = data.tmp;
        this.fac = data.fac;
        this.pac = data.pac;
        this.sac = data.sac;
        this.qac = data.qac;
        this.eto = data.eto;
        this.etd = data.etd;
        this.hto = data.hto;
        this.pf = data.pf;
        this.wan = data.wan;
        this.err = data.err;
        this.vac = data.vac;
        this.iac = data.iac;
        this.vpv = data.vpv;
        this.ipv = data.ipv;
        this.str = data.str;
        this.stu = data.stu;
        this.pac1 = data.pac1;
        this.qac1 = data.qac1;
        this.pac2 = data.pac2;
        this.qac2 = data.qac2;
        this.pac3 = data.pac3;
        this.qac3 = data.qac3;
    }
}

export default InverterData