const fs =              require("fs");
const cp =              require("child_process");
const EventEmitter =    require("events");

const logPrefix = 'pi802-11Class.js | ';

/**
 * This class provides an interface to the wireless command line client (wpa_cli).  It allows you to find wirless hubs and connect to them.
 * It emits **configUpdate**, **essiUpdate** and **iNetReachable**.
 * **essiUpdate** is emitted when a call to this.getWirelessHubList() is made and a new hub has been detected or lost.  
 * **iNetReachable** is emitted when a call to this.checkInternetConnection() is made and the connection status has changed.
 * 
 * To make a wireless connection: 
 * 1) Call this.updateAll()
 * 2) look inside this.availableNetworks to find a hub (ssid) to connect to
 * 3) call this.setNet_WPAx(ssid, password);
 * 
 * @param {string} country 'US' wirless country code
 */
class wipi extends EventEmitter{
    constructor(country = 'US'){
        super();
        this.config = {
            Associated:false,
            Quality:"",
            SigLevel:"",
            CnctdName:"",
            CnctdAdd:"",
            IpAdd:"",
            MacAdd:"",
            hostName:"",
            iNetReachable:null
        };
        this.availableNetworks = [];
    };

    /** Updates all fields in this.config
     * Checks if connected to wireless hub and if connected gets wirless adapter configuration.
     * If connected to wireless hub will ping google.com to see if internet connection is up.
     * Checks for available wireless access points
     * 
     * Returns a promise with results of wireless access points scan...
     */
    updateAll(){
        if(chkConnected(this.config)){
            this.checkInternetConnection();
            this.emit('configUpdate', this.config);
        }
        var promise = this.getWirlessHubList();
        return promise;
    };

    /** Checks if connected to wireless access point and reads configuration of wireless adapter. */
    updateConfig(){
        if(chkConnected(this.config)){
            this.emit('configUpdate', this.config);
        }
    };

    /** Checks for available wireless access points.
     * Returns a promise and poupulates this.availableNetworks
     * emits essiUpdate
     */
    getWirlessHubList(){
        var preUpdateEssiList = [];
        this.availableNetworks.forEach((item)=>{
            preUpdateEssiList.push(item.essid);
        });
        var myPromise = getESSIDlist();
        myPromise.then((result) => {
            this.availableNetworks = result;
            var updatedEssiList = [];
            this.availableNetworks.forEach((item)=>{
                updatedEssiList.push(item.essid);
            });
            if(JSON.stringify(updatedEssiList) != JSON.stringify(preUpdateEssiList)){
                this.emit('essiUpdate', this.availableNetworks);
            };
        });
        return myPromise;
    };

    /** Pings an address on the internet to check connection status.
     * Returns ture or false
     * emits iNetReachable when the status changes.
     * 
     * @param {String} addToPing 'google.com'
     */
    checkInternetConnection(addToPing = 'google.com'){    // Checks if Pi is connected to Interent by pinging google.com
        var iNetUp = chkInet(addToPing);
        if(iNetUp){
            if(this.config.iNetReachable != true){
                this.config.iNetReachable = true;
                if(this.listenerCount('iNetReachable')== 0){
                    logit('Internet connection OKAY to ' + addToPing + ', at ' + (new Date()).toLocaleTimeString());
                };
                this.emit('iNetReachable', this.config.iNetReachable);
            };
            return true;
        } else {
            if(this.config.iNetReachable != false){
                this.config.iNetReachable = false;  
                if(this.listenerCount('iNetReachable')== 0){
                    console.warn('Error: Internet connection not reachable to ' + addToPing + ', at ' + (new Date()).toLocaleTimeString());
                };
                this.emit('iNetReachable', this.config.iNetReachable);
            };
            return false;
        };
    };

    /** Connects this device to a wireless hub.  Updates the /etc/wpa_supplicant/wpa_supplicant.conf with the new SSID and passkey.
     * If passkey is > 7 characters it will be encrypted in the wpa_supplicant.conf file.
     * 
     * Once the wpa_supplicant.conf has been updated an attempt will be made to connect to the new hub. 
     * If that fails and there was a previous good connection an attempt will be made to rollback to the previous working wireless configuration. 
     * 
     * * **ssid** = the SSID of the wireless network to connect to
     * * **psk** = the pre shared key or password for this ssid
     * * **cbRptFunction** is a function to log progress of the process.  It will be passed a text string.
     * 
     * @param {string} ssid 
     * @param {string} psk 
     * @param {Function} log 
     */
    setNet_WPAx(ssid = '', psk = '', log = (val)=>{logit('--> '+val+' <--')}){
        logit('Setting new network with WPAx level security for SSID = ' + ssid);
        var rS = updateWpa_WPAx(ssid, psk, log);
        if(rS == 0){
            verifyNetwork(log);
            this.updateAll();
        } else {
            console.warn('Error updating wpa_supplicant.conf file.  Network change request canceled!');
            log('Error updating wpa_supplicant.conf file.  Network change request canceled!');
        };
    };

    /** Connects this device to a wireless hub that supports enterprise level security (RADIUS server).  Stores the settings in the /etc/wpa_supplicant/wpa_supplicant.conf file.
     * 
     * Once the wpa_supplicant.conf has been updated an attempt will be made to connect to the new hub. 
     * If that fails and there was a previous good connection an attempt will be made to rollback to the previous working wireless configuration. 
     * 
     * * **ssid** = the SSID of the wireless network to connect to
     * * **psk** = the pre shared key this ssid
     * * **id** = identity for RADIUS account
     * * **cbRptFunction** is a function to log progress of the process.  It will be passed a text string.
     * 
     * @param {string} ssid 
     * @param {string} psk 
     * @param {string} id 
     * @param {Function} cbRptFunction 
     */
    setNet_WPA2_EAP(ssid = '', psk = '', id = '', log = (val)=>{logit('--> '+val+' <--')}){
        logit('Setting new network with WPA2 Enterprise level security for SSID = ' + ssid);
        logit('setNet_WPA2_EAP method disabled...');
        log('setNet_WPA2_EAP method disabled...');
    };

    /** Gets network bytes since last reboot 
     * Returns object = {"rxBytes":"","txBytes":""}
     * 
     * @param {String} iface = network interface to report on defaults to wlan0
     */
    getNetworkTraffic(iface = 'wlan0'){
        return getTraffic(iface);
    };

    /** Clears all wireless networks in wpa_supplicant
     * 
     * @param {object} log Logging object see default value for example 
     */
    clearWirelessConnections(log = (val)=>{logit('--> '+val+' <--')}){
        console.warn('Cearing all wireless connections...');
        log('Cearing all wireless connections...');
        clearWirelessConnections(log);
    };
};

function clearWirelessConnections(log = (val)=>{logit('--> '+val+' <--')}){
    try{
        let listNetworks = '';
        let rslt = cp.execSync('/sbin/wpa_cli list_networks');
        listNetworks = rslt.toString().split('\n');
        let nextLineWillStartWithNetworkNumber = false;
        let networkCount = 0;
        listNetworks.forEach((item = '', ndx)=>{
            if(nextLineWillStartWithNetworkNumber == true){
                let pLine = item.trim().split('\t');
                if(pLine[0] !== undefined && pLine[0] !== ''){
                    networkCount++;
                    let netNum = pLine[0].trim();
                    let netName = '';
                    if(pLine[1] !== undefined){netName = pLine[1].trim()};
                    logit('Removing network ' + netNum + ' = ' + netName);
                    log('Removing network ' + netNum + ' = ' + netName);
                    cp.execSync('/sbin/wpa_cli remove_network ' + netNum);
                }
            } else {
                if(item.startsWith('network id')){
                    nextLineWillStartWithNetworkNumber = true;      //read through file unitl you find: network id / ssid / bssid / flags
                };
            };
        });
        if(networkCount > 0){
            logit('Saving changes to wpa_supplicant');
            log('Saving changes to wpa_supplicant');
            cp.execSync('/sbin/wpa_cli save_config');
        };
        logit('Removed ' + networkCount + ' network(s).');
        log('Removed ' + networkCount + ' network(s).');
    } catch(err){
        console.error('Error clearWirelessConnections ', err);
        log('Error clearWirelessConnections ' + err);
    };
};

function getTraffic(iface = 'wlan0'){
    let rtnObj = {
        "rxBytes":"",
        "txBytes":""
    };
    logit('Reading network traffic...');
    try {
        let r = cp.execSync('/bin/ip -s link show ' + iface);
        let resultStr = r.toString();
        let line = resultStr.split('\n');
        line.forEach((val, indx)=>{
            let x = val.trim();
            if(x.startsWith('RX:')){
                let rxLine = line[indx+1];
                rxLine = rxLine.trim();
                let i = rxLine.split(' ');
                rtnObj.rxBytes = i[0].trim()
            } else if(x.startsWith('TX:')){
                let txLine = line[indx+1];
                txLine = txLine.trim();
                let i = txLine.split(' ');
                rtnObj.txBytes = i[0].trim()
            }; 
        });
        logit('RX bytes = ' + rtnObj.rxBytes + ' TX bytes = ' + rtnObj.txBytes);
    } catch (err){
        console.error('Error with getTraffic function in pi802-11Class.js',err);
    };
    return rtnObj;
};

function verifyNetwork(log = (val)=>{logit('--> '+val+' <--')}, rollingBack = false){                               // uses linux shell commands restart 802.11x and load new settings
    logit('Verifying 802.11x settings…');
    log('Verifying 802.11x settings…');
    var resultStr = cp.execSync('/sbin/wpa_cli -i wlan0 reconfigure');
    if(rollingBack == false){
        logit('802.11x reconfigure result = ' + resultStr);
        log('802.11x reconfigure result = ' + (resultStr.toString()).trim());
    };
    if ((resultStr.toString()).trim() == 'OK'){
        resultStr = cp.execSync('/sbin/wpa_cli -i wlan0 reassociate');
        if(rollingBack == false){
            logit('802.11x reassociate result = ' + resultStr);
            log('802.11x reassociate result = ' + (resultStr.toString()).trim());
        }
        if((resultStr.toString()).trim() == 'OK'){
            var count = 5;
            log('Waiting for IP Address...');
            var checkIpTimer = setInterval(function(){
                var str = (cp.execSync('/bin/hostname -I')).toString(); 
                var y = str.split('\n');
                var ip = y[0].trim();
                logit('Attempt '+ count +' 802.11x IP ==>' + ip + '<==');
                count--;
                if(ip != ''){
                    clearInterval(checkIpTimer);
                    logit('Received iP address ' + ip);
                    log('Received IP ==>' + ip + '<==');
                    if(rollingBack == false){
                        log('New 802.11x connection established!');
                    } else {
                        log('Rollback to previous 802.11x config successful.');
                        log('Failed to connect to new 802.11x network.');
                    };
                    cleanWpaConfig(log);
                } else if(count == 0){
                    logit('stopping checkIpTimer');
                    log('Error getting IP address');
                    clearInterval(checkIpTimer);
                    if(rollingBack == false){
                        restoreWpaSupplicant(log);
                    } else {
                        logit('Rolling Back to previous 802.11 config Failed!');
                        log('Rolling Back to previous 802.11 config Failed!');
                        cleanWpaConfig(log);
                    };
                } else {
                    log( count * 6 + ' seconds until IP timeout.');
                    logit( count * 6 + ' seconds until IP timeout.');
                };
            },6000);
        } else {
            if(rollingBack == false){
                restoreWpaSupplicant(log);
            };
        };
    } else {
        if(rollingBack == false){
            restoreWpaSupplicant(log);
        };
    };
};

function cleanWpaConfig(log = (val)=>{logit('--> '+val+' <--')}){
    logit('Removing all disabled networks from wpa_supplicant file...');
    var networksDeleted = 0;
    var networkConfig = '';
    var x = cp.execSync('/sbin/wpa_cli -i wlan0 list_networks');
    networkConfig = x.toString();
    var arrayOfLines = [];
    var arrayOfFields = [];
    arrayOfLines = networkConfig.split('\n');
    arrayOfLines.forEach((val, indx)=>{
        if(indx > 0){
            arrayOfFields = val.split('\t');
            if(arrayOfFields.length > 3){
                if(arrayOfFields[3].includes("[DISABLED]")){
                    var x = cp.execSync('/sbin/wpa_cli -i wlan0 remove_network ' + arrayOfFields[0]);
                    networksDeleted++;
                };
            };
        };
    });
    if(networksDeleted > 0){
        logit('Deleted ' + networksDeleted + ' network(s) from wpa_supplicant. Saving new config...');
        var x = cp.execSync('/sbin/wpa_cli -i wlan0 save_config');
        logit('Result ->' + x.toString().trim());
    } else {
        logit('No extra networks found, wpa_supplicant is clean.');
    };
};

function updateWpa_WPAx(ssid = '', psk = '', log = (val)=>{logit('--> '+val+' <--')}){
    if(psk.length < 8){
        console.warn('Warrning Pre-shared key (network password) to short! Must be > 7 characters!');
        log('ERROR Pre-shared key (network password) to short! Must be > 7 characters!');
        return 1;
    };   
    var result = '';
    var encryptedPSK = cp.execSync('/usr/bin/wpa_passphrase "' + ssid + '" "' + psk + '"');  
    var eP = encryptedPSK.toString().split('\n');
    var ePSK = eP[3].trim();
    eP = ePSK.split('=');
    ePSK = eP[1].trim();
    var x = cp.execSync('/sbin/wpa_cli -i wlan0 add_network');
    var netNum = x.toString();
    netNum = netNum.trim();
    logit('/sbin/wpa_cli -i wlan0 set_network ' + netNum + " ssid '" + '"' + ssid + '"' + "'");
    result = cp.execSync('/sbin/wpa_cli -i wlan0 set_network ' + netNum + " ssid '" + '"' + ssid + '"' + "'");
    logit('\t' + result.toString().trim());
    if(result.toString().trim() != 'OK'){
        console.error('Error setting ssid variable in wpa_supplicant.conf');
        log('Error setting ssid variable in wpa_supplicant.conf');
        return 1;
    };
    logit('/sbin/wpa_cli -i wlan0 set_network ' + netNum + ' psk ' + '###########' );
    result = cp.execSync('/sbin/wpa_cli -i wlan0 set_network ' + netNum + ' psk ' + ePSK );
    logit('\t' + result.toString().trim());
    if(result.toString().trim() != 'OK'){
        console.error('Error setting psk variable in wpa_supplicant.conf');
        log('Error setting psk variable in wpa_supplicant.conf');
        return 1;
    };
    logit('/sbin/wpa_cli -i wlan0 select_network ' + netNum);
    result = cp.execSync('/sbin/wpa_cli -i wlan0 select_network ' + netNum);
    logit('\t' + result.toString().trim());
    logit('/sbin/wpa_cli -i wlan0 save_config');
    result = cp.execSync('/sbin/wpa_cli -i wlan0 save_config');
    logit('\t' + result.toString().trim());
    return 0;
};

function restoreWpaSupplicant(log = (val)=>{logit('--> '+val+' <--')}){
    logit('Looking for backup network in wpa_supplicant file...');
    var foundBackupConfig = false;
    var networkConfig = '';
    var x = cp.execSync('/sbin/wpa_cli -i wlan0 list_networks');
    networkConfig = x.toString();
    var arrayOfLines = [];
    var arrayOfFields = [];
    arrayOfLines = networkConfig.split('\n');
    arrayOfLines.forEach((val, indx)=>{
        if(indx > 0){                                                                               // skip first line
            arrayOfFields = val.split('\t');                                                        // make an array of strings from tab aligned text
        if(arrayOfFields.length > 3){                                                               // make sure array has atleast 4 elements
                if(arrayOfFields[3].includes("[CURRENT]")){                                         // element 3 has a status setting
                    logit('Current Network number = '+ arrayOfFields[0]);
                } else if(arrayOfFields[3].includes("[DISABLED]") && foundBackupConfig == false){   // found the first disabled netowrk (should be the old net config lets use it)
                    foundBackupConfig = true;
                    logit('Found backup network, activating network number = '+ arrayOfFields[0]);
                    logit('/sbin/wpa_cli -i wlan0 select_network ' + arrayOfFields[0]);
                    var result = cp.execSync('/sbin/wpa_cli -i wlan0 select_network ' + arrayOfFields[0]);
                    logit('\t' + result.toString().trim());
                    logit('/sbin/wpa_cli -i wlan0 save_config');
                    result = cp.execSync('/sbin/wpa_cli -i wlan0 save_config');
                    logit('\t' + result.toString().trim());
                };
            };
        };
    });
    if(foundBackupConfig==true){
        logit('Backup network configuration found and selected.');
        log('Backup network configuration found and selected.');
        verifyNetwork(log, true);
    } else {
        logit('No 802.11x backup exist.');
        log('No 802.11x backup exist');
    };
};

function chkInet(addToPing){
    try {
        var resultStr = (cp.execSync('/bin/ping -c1 '+ addToPing + ' | /bin/grep -c "1 received"')).toString();
        if(resultStr == 1){
            return true;
        } else {
            return false;
        };
    }catch(err) {
        console.error('ERROR chkInet =>' + err + '<=');
        return false;
    };
};

function makeWpaSupplicant_WPA2_EAP(ssid, psk, id){
    var strToAppend = '';
    strToAppend = '\nnetwork={\n';
    strToAppend += '\tssid="' + ssid + '"\n';
    strToAppend += '\tscan_ssid=1\n';
    strToAppend += '\tkey_mgmt=WPA-EAP\n';
    strToAppend += '\teap=PEAP\n';
    strToAppend += '\tidentity="' + id + '"\n';
    strToAppend += '\tpassword="' + psk + '"\n';
    strToAppend += '}\n';
    logit('Reading /etc/wpa_supplicant/wpa_supplicant.conf.header');
    var wpaHeader = fs.readFileSync('/etc/wpa_supplicant/wpa_supplicant.conf.header');    
    logit('Writing new /etc/wpa_supplicant/wpa_supplicant.conf');
    fs.writeFileSync('/etc/wpa_supplicant/wpa_supplicant.conf', wpaHeader + strToAppend);
};

function parseAndSetIP(dObj = {}){                  // finds local IP address, network name, and Mac address
    try{
        // get ip address (may be more than one)
        var rsp = cp.execSync('/bin/hostname -I');
        var str = rsp.toString();    
        var y = str.split('\n');
        dObj.IpAdd = y[0].trim();    

        // get network name
        rsp = cp.execSync('/bin/hostname');
        str = rsp.toString(); 
        y = str.split('\n');
        dObj.hostName = y[0].trim(); 

        // get mac address
        rsp = cp.execSync('/sbin/ip addr show wlan0');
        str = rsp.toString(); 
        var x = str.slice(str.search('link/ether ') + 11);
        y = x.split(' ');
        dObj.MacAdd = y[0].trim();
    }catch(err){
        console.error('Error in parseAndSetIP():', err);
    };   
};

function chkConnected(dObj = {}){                   // spawns iwcong and looks for string 'Not-Associated'
    try {
        var rsp = cp.execSync('/sbin/iwconfig wlan0');
        var rspString = rsp.toString();
        if(rspString.includes("Not-Associated") || rspString.includes("Ad-Hoc")){
            logit('802.11x not associated');
            dObj.Associated=false;
            parseAndSetIP(dObj);
            return false;
        } else {
            dObj.Associated=true;
            parseIwconfig(rspString, dObj);
            parseAndSetIP(dObj);
            return true;
        };
    }catch(err){
        console.error('Error in exports.802.11xChkConnected:', err);
        console.error('Error 802.11x not associated');
        dObj.Associated=false;
        return false;
    };
};

function getESSIDlist(){                            // wait 2 seconds for scan to complete then return result in promise
    var hubList=[];
    var essidDetailList=[];
    var promise = new Promise((resolve, reject) => {   
        try {
        var resultStr = cp.execSync('/sbin/wpa_cli -i wlan0 scan');         
        setTimeout(() => {
            resultStr = cp.execSync('/sbin/wpa_cli -i wlan0 scan_results');
            resultStr = resultStr.toString();
            var routerListArry = resultStr.split("\n");
            
            for (let index = 0; index < routerListArry.length; index++) {
                if((routerListArry[index].toString()).indexOf(':') != -1){
                    var tmpObj = {};
                    var detailArray = (routerListArry[index].toString()).split("\t");
                    tmpObj.essid = detailArray[4].toString();
                    tmpObj.sigLevel = detailArray[2].toString();
                    if((detailArray[3].toString()).indexOf('WPA2-EAP') != -1){
                        tmpObj.security = 'WPA2-EAP';
                    } else if((detailArray[3].toString()).indexOf('WPA2-PSK') != -1){
                        tmpObj.security = 'WPA2-PSK';
                    } else if((detailArray[3].toString()).indexOf('WPA-PSK') != -1){
                        tmpObj.security = 'WPA-PSK';
                    } else {
                        tmpObj.security = 'low';
                    };
                    var dup = false;
                    hubList.forEach((item, index)=>{
                        if(tmpObj.essid == item.essid){
                            dup = true;
                            if(parseInt(tmpObj.sigLevel) > parseInt(item.sigLevel)){
                                hubList[index] = tmpObj;
                            };
                        };
                    });
                    if(dup == false){hubList.push(tmpObj)};
                    essidDetailList.push(tmpObj);
                };
            };
            // Sort details list based on essid name
            essidDetailList.sort(function(a,b){
                var x = a.essid.toLowerCase();
                var y = b.essid.toLowerCase();
                return x.localeCompare(y);
            });
            // Sort hub list based on sigLevel
            hubList.sort(function(a,b){
                return parseInt(b.sigLevel) - parseInt(a.sigLevel);
            });
            resolve (hubList);
        }, 2000);
        } catch(err){
            console.error('Error with getESSIDList.', err);
            reject(err)
        }
    });
    return promise;
};

function parseIwconfig(str = "", dObj = {}){        // parse output of iwconfig passed as str
    // Find ESSID name we are connected to
    var x = str.slice(str.search('ESSID:"') + 6);
    var y = x.split('"');
    dObj.CnctdName = y[1].trim();

    // find access point address we are connected to
    x = str.slice(str.search('Access Point:') + 13);
    y = x.split('\n');
    dObj.CnctdAdd = y[0].trim();

    // find link quality of connection
    x = str.slice(str.search('Link Quality=') + 13);
    y = x.split(' ');
    dObj.Quality = y[0].trim();

    // find signal level of connection
    x = str.slice(str.search('Signal level=') + 13);
    y = x.split(' ');
    dObj.SigLevel = y[0].trim();
};

function logit(txt = ''){
    console.debug(logPrefix + txt)
};

module.exports = wipi;