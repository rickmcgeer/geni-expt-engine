//Copyright (c) 2014 US Ignite 
// 
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
//and/or hardware specification (the “Work”) to deal in the Work without restriction, including 
//without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or 
//sell copies of the Work, and to permit persons to whom the Work is furnished to do so, subject to 
//the following conditions: 
// 
//The above copyright notice and this permission notice shall be included in all copies or 
//substantial portions of the Work. 
// 
//THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
//OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
//MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
//NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
//HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
//WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
//OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS 
//IN THE WORK.
module.exports = function (app, passport, Users, Slices, urls, url, script_dir) {
    var route_utils = require('./route_utils');
    require('./admin')(app, route_utils, Users, Slices, url, script_dir);
    require('./auth')(app, passport);
    require('./main')(app);
    require('./slice')(app, route_utils, urls, url, Users, Slices, script_dir);
    require('./user')(app, route_utils, Users, Slices, urls, script_dir);
}