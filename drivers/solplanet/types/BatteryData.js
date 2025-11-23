

class BatteryData {

    flg; // Battery status flag
    tim; // Timestamp of data
    ppv; // PV power in W
    etdpv; // PV energy today in 0.1 kWh
    etopv; // PV energy total in 0.1 kWh
    cst; // Communication status code
    bst; // Battery status code
    eb1; // Battery error code group 1
    eb2; // Battery error code group 2
    eb3; // Battery error code group 3
    eb4; // Battery error code group 4
    wb1; // Battery warning code group 1
    wb2; // Battery warning code group 2
    wb3; // Battery warning code group 3
    wb4; // Battery warning code group 4
    vb; // Battery voltage in 0.01 V
    cb; // Battery current in 0.1 A
    pb; // Battery power in W
    tb; // Battery temperature in 0.1°C
    soc; // State of charge in %
    soh; // State of health in %
    cli; // Current limit for charging in 0.1 A
    clo; // Current limit for discharging in 0.1 A
    ebi; // Battery energy for charging in 0.1 kWh
    ebo; // Battery energy for discharging in 0.1 kWh
    eaci; // AC energy for charging in 0.1 kWh
    eaco; // AC energy for discharging in 0.1 kWh
    vesp; // EPS voltage in 0.1 V
    cesp; // EPS current in 0.1 A
    fesp; // EPS frequency in 0.01 Hz
    pesp; // EPS power in W
    rpesp; // EPS reactive power in VAr
    etdesp; // EPS energy today in 0.1 kWh
    etoesp; // EPS energy total in 0.1 kWh
    charge_ac_td; // AC charge today in 0.1 kWh
    charge_ac_to; // AC charge total in 0.1 kWh
    vl1esp; // EPS phase 1 voltage in 0.1 V
    il1esp; // EPS phase 1 current in 0.1 A
    pac1esp; // EPS phase 1 power in W
    qac1esp; // EPS phase 1 reactive power in VAr
    vl2esp; // EPS phase 2 voltage in 0.1 V
    il2esp; // EPS phase 2 current in 0.1 A
    pac2esp; // EPS phase 2 power in W
    qac2esp; // EPS phase 2 reactive power in VAr
    vl3esp; // EPS phase 3 voltage in 0.1 V
    il3esp; // EPS phase 3 current in 0.1 A
    pac3esp; // EPS phase 3 power in W
    qac3esp; // EPS phase 3 reactive power in VAr
    
    constructor( data ) {
        this.flg = data.flg;
        this.tim = data.tim;
        this.ppv = data.ppv;
        this.etdpv = data.etdpv;
        this.etopv = data.etopv;
        this.cst = data.cst;
        this.bst = data.bst;
        this.eb1 = data.eb1;
        this.eb2 = data.eb2;
        this.eb3 = data.eb3;
        this.eb4 = data.eb4;
        this.wb1 = data.wb1;
        this.wb2 = data.wb2;
        this.wb3 = data.wb3;
        this.wb4 = data.wb4;
        this.vb = data.vb;
        this.cb = data.cb;
        this.pb = data.pb;
        this.tb = data.tb;
        this.soc = data.soc;
        this.soh = data.soh;
        this.cli = data.cli;
        this.clo = data.clo;
        this.ebi = data.ebi;
        this.ebo = data.ebo;
        this.eaci = data.eaci;
        this.eaco = data.eaco;
        this.vesp = data.vesp;
        this.cesp = data.cesp;
        this.fesp = data.fesp;
        this.pesp = data.pesp;
        this.rpesp = data.rpesp;
        this.etdesp = data.etdesp;
        this.etoesp = data.etoesp;
        this.charge_ac_td = data.charge_ac_td;
        this.charge_ac_to = data.charge_ac_to;
        this.vl1esp = data.vl1esp;
        this.il1esp = data.il1esp;
        this.pac1esp = data.pac1esp;
        this.qac1esp = data.qac1esp;
        this.vl2esp = data.vl2esp;
        this.il2esp = data.il2esp;
        this.pac2esp = data.pac2esp;
        this.qac2esp = data.qac2esp;
        this.vl3esp = data.vl3esp;
        this.il3esp = data.il3esp;
        this.pac3esp = data.pac3esp;
        this.qac3esp = data.qac3esp;
    }
}

export default BatteryData