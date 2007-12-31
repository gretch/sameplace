/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


/**
 * An interface for managing scriptlets.
 *
 * At the moment, it does not load scriptlets by itself, instead it
 * expects a scriptlets object to be passed to from the opener (via
 * window.openDialog or windowWatcher.openWindow).
 *
 */

// DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

var srvPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService);


// STATE
// ----------------------------------------------------------------------

var scriptlets;


// INITIALIZATION/FINALIZATION
// ----------------------------------------------------------------------

function init(event) {
    scriptlets = window.arguments[0];
    refreshScriptlets();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function refreshScriptlets() {
    while($('#scriptlets')._.lastChild)
        $('#scriptlets')._.removeChild($('#scriptlets')._.lastChild)

    scriptlets.forEach(
        function(scriptlet) {
            var xulScriptlet = $('#blueprints > .scriptlet')._.cloneNode(true);
            updateScriptlet(xulScriptlet, scriptlet);
            $('#scriptlets')._.appendChild(xulScriptlet);
        });
}

function createScriptlet(name) {
    try {
        var scriptlet = scriptlets.create(name);
        scriptlet.enable();
        edit(scriptlet.fileName);
        refreshScriptlets();
    } catch(e) {
        window.alert(e);
    }
}

function updateScriptlet(xulScriptlet, scriptlet) {
    $(xulScriptlet).$('.filename')._.value = scriptlet.fileName;
    try {
        $(xulScriptlet).$('.title')._.value = scriptlet.info.name;
        $(xulScriptlet).$('.version')._.value = scriptlet.info.version;
        $(xulScriptlet).$('.description')._.value = scriptlet.info.description;
        $(xulScriptlet).$('.enabled')._.checked = scriptlet.enabled;
    } catch(e) {
        $(xulScriptlet).$('.title')._.value = scriptlet.fileName;
        $(xulScriptlet).$('.description')._.value = 'Error while reading.';
    }
}


// GUI REACTIONS
// ----------------------------------------------------------------------

var dndObserver = {
    onDrop: function(event, transferData, session) {
        if(transferData.flavour.contentType == 'text/x-moz-url') {
            var parts = transferData.data.split('\n');
            var url = parts[0];
            var name = parts[1];
            if(name.match(/\.js$/))
                requestedInstallRemoteScriptlet(url);
        }
    },

    onDragOver: function(event, flavour, session) {},

    getSupportedFlavours: function() {
        if(!this._flavourSet) {
            this._flavourSet = new FlavourSet();
            this._flavourSet.appendFlavour("text/x-moz-url");
            this._flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
        }
        return this._flavourSet;
    }
};

function requestedToggleScriptletActivation(xulCheckbox) {
    var fileName = $(xulCheckbox).$('^ .scriptlet .filename')._.value;
    var scriptlet = scriptlets.get(fileName);
    if(scriptlet.enabled)
        scriptlet.disable();
    else
        scriptlet.enable();
}

function requestedEditScriptlet(xulEdit) {
    edit($(xulEdit).$('^ .scriptlet .filename')._.value);
}

function requestedCreateScriptlet() {
    var name = { value: 'unnamed' };

    var confirm = srvPrompt.prompt(
        null, 'Creating scriptlet', 'Choose a name for the scriptlet.  Filename will be <name>.js ', name, null, {});

    if(confirm)
        createScriptlet(name.value + '.js');
}

function requestedInstallRemoteScriptlet(url) {
    if(isFromTrustedDomain(url) ||
       window.confirm(
           'Scriptlets are like extensions: malicious ones can harm your computer!\n' +
               'Only proceed if you trust the source.'))
        return installRemoteScriptlet(url);
    else
        return false;
}

function installRemoteScriptlet(url) {
    var process = {
        start       : { ok: 'requestData' },
        requestData : { ok: 'saveData', error: 'alertUser' },
        saveData    : { ok: 'enableScriptlet', error: 'alertUser'},
        enableScriptlet: { ok: 'refreshScriptlets', error: 'alertUser' }
    };
    // XXX use let() here
    var parts = url.split('/');
    var name = parts[parts.length-1];
    
    // XXX get rid of execute(process), use a bunch of functions
    // instead.  less cool but more comprehensible.
    var steps = {
        requestData: function(next, url, name) {
            var req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.onreadystatechange = function(event) {
                if(req.readyState == 4) {
                    if(req.status == 200)
                        next('ok', name, req.responseText);
                    else
                        next('error', 'Error loading scriptlet.');
                }
            };
            req.send(null);
        },

        saveData: function(next, name, data) {
            try {
                var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
                file.initWithFile(scriptlets.dir);
                file.append(name);

                var foStream = Cc['@mozilla.org/network/file-output-stream;1']
                .createInstance(Ci.nsIFileOutputStream);
                
                foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0);
                foStream.write(data, data.length);
                foStream.close();
                next('ok');
            } catch(e) {
                next('error', 'Error while saving file. (' + e + ')');
            }
        },

        alertUser: function(next, message) {
            window.alert(message);
        },

        enableScriptlet: function(next) {
            try {
                scriptlets.get(name).enable();
                next('ok');
            } catch(e) {
                next('error', 'Error while enabling scriptlet. (' + e + ')');
            }
        },

        refreshScriptlets: function(next) {
            refreshScriptlets();
            $('#scriptlets')._.selectedItem =
                $('#scriptlets .filename[value="' + name + '"] ^ .scriptlet')._;
        }
    };

    execute(process, steps, url, name);
    
    return true;
}

function uninstall(xulUninstall) {
    scriptlets.get($(xulUninstall).$('^ .scriptlet .filename')._.value).uninstall();
    refreshScriptlets();
}

function reload(xulReload) {
    var xulScriptlet = $(xulReload).$('^ .scriptlet')._;
    var fileName = $(xulScriptlet).$('.filename')._.value;
    var scriptlet = scriptlets.get(fileName);
    try {
        scriptlet.reload();
    } catch(e) {
        window.alert(e + '\n' + e.stack);
    }
    updateScriptlet(xulScriptlet, scriptlet);
}

function edit(fileName) {
    window.openDialog('chrome://sameplace/content/scriptlet_editor.xul',
                      'SamePlace:ScriptletEditor', '',
                      scriptlets.get(fileName));
}


// GUI UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}


// UTILITIES
// ----------------------------------------------------------------------

function isFromTrustedDomain(uri) {
    var xpcomURI = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService)
    .newURI(uri, null, null);

    return (xpcomURI.host.match(/(^|\.)sameplace\.cc$/ ||
            uri.host != 'repo.hyperstruct.net'))
}
