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
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


function Echo(server) {
    this._server = server;
    this._jid = this.name + '.' + this._server.jid;
}

Echo.prototype.__defineGetter__('name', function() {
    return 'echo';
});

Echo.prototype.receive = function(element) {
    if(element.name() == 'message')
        this._server.fromService(this,
                                 <message to={element.@from}>
                                 <body>You said: {element.body.text()}</body>
                                 </message>);
};
