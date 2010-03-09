/*
  TODO:
  - AST base object: function(arg){ return new App(self, arg) }
  - higher order function
  - reduce -> visit (for PP and the other functionalities)
  - interactive UI
  -- push into stack when eval return undefined (e.g. let)
  -- mark redex
  -- manual mode (strategy which requires user to choose redex)
  -- mark alpha conversion?
  - test in other browsers
*/

if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    ns.Sandbox = function() {
        var window = null;
        var document = null;
        var alert = null;
        this.fun = function(arg, f) {
            return new ns.Semantics.Abs(arg, f);
        };
        this.run = function(code){ with (this) return eval(code); }
    };

    var promote = function(v) {
        if (['abs', 'app', 'var'].indexOf(v.type||'') == -1) {
            return new ns.Semantics.Var(v);
        }
        return v;
    };
    var freshVar = function(used, v) {
        if (!used[v]) return v;
        if (/^([a-z])([0-9]*)$/.test(v)) {
            var code = RegExp.$1.charCodeAt(0)+1;
            var num = RegExp.$2;
            if ('z'.charCodeAt(0) < code) {
                if (!num.length) num = 0;
                return freshVar(used, 'a'+(num+1));
            } else {
                return freshVar(used, String.fromCharCode(code)+num);
            }
        } else {
            return freshVar(used, 'a');
        }
    };

    ns.Semantics = {
        Abs: function(arg, func) {
            var self = function(arg) {
                return new ns.Semantics.App(self, arg);
            };
            self.type = 'abs';
            self.arg = promote(arg);
            self.body = func.call(null, new ns.Semantics.Var(arg));
            self.subst = function(arg, v) { // (\x.M)[v:=N]
                if (typeof v == 'undefined') {
                    v = self.arg;
                } else if (v == self.arg) { // (\x.M)[x:=N] = \x.M
                    return self;
                }
                var fv1 = self.body.fv();   // fv(M)
                var fv2 = arg.fv();         // fv(N)
                if (fv1[v] && fv2[self.arg]) {
                    fv2[v] = true;
                    var fresh = freshVar(fv2, self.arg);
                    self.body = self.body.subst(fresh, self.arg);
                    self.arg = self.arg.subst(fresh, self.arg);
                }
                self.body = self.body.subst(arg, v);
                return self;
            };
            self.fv = function() {
                var fv = self.body.fv();
                fv[self.arg] = false;
                return fv;
            };
            self.reduce = function(strategy){ return strategy.redAbs(self); };
            self.toString = function() {
                return [ 'Fun(', self.arg, ') ', self.body, ].join('');
            };
            return self;
        },
        App: function(func, arg) {
            var self = function(arg) {
                return new ns.Semantics.App(self, arg);
            };
            self.type = 'app';
            self.fun = func;
            self.arg = promote(arg);
            self.reduce = function(strategy){ return strategy.redApp(self); };
            self.subst = function(arg, v) {
                self.fun = self.fun.subst(arg, v);
                self.arg = self.arg.subst(arg, v);
                return self;
            };
            self.fv = function() {
                var fv1 = self.fun.fv();
                var fv2 = self.arg.fv();
                for (var p in fv1) fv2[p] = fv2[p] || fv1[p];
                return fv2;
            };
            self.toString = function() {
                return [ 'App(', self.fun, ', ', self.arg, ')' ].join('');
            };
            return self;
        },
        Var: function(v) {
            var self = function(arg) {
                return new ns.Semantics.App(self, arg);
            };
            self.type = 'var';
            self.v = v;
            self.reduce = function(strategy){ return strategy.redVar(self); };
            self.subst = function(arg, v) {
                return self.v == v ?  arg : self;
            };
            self.fv = function() {
                var fv = {};
                fv[self.v] = true;
                return fv;
            };
            self.toString = function(){ return self.v; };
            return self;
        },
        Strategy: {
            Generic: function() {
                var self = { reduced: false };
                // reduce by visitor pattern
                self.reduce = function(exp){ return exp.reduce(this); };
                self.redAbs = function(abs){ return abs; };
                self.redApp = function(app) {
                    app.fun = app.fun.reduce(self);
                    if (app.fun.type != 'abs') return app;
                    if (!self.reduced) {
                        app.arg = self.redArg(app.arg);
                    }
                    if (!self.reduced) {
                        self.reduced=true;
                        return self.subst(app.fun, app.arg).body;
                    }
                    return app;
                };
                self.redArg = function(arg){ return arg; };
                self.redVar = function(v){ return v; };
                return self;
            },
            CallByName: function() {
                var self = new ns.Semantics.Strategy.Generic();
                return self;
            },
            CallByValue: function() {
                var self = new ns.Semantics.Strategy.Generic();
                self.redArg = function(arg){ return arg.reduce(self); };
                return self;
            },
            NormalOrder: function() {
                var self = new ns.Semantics.Strategy.Generic();
                self.redAbs = function(abs) {
                    abs.body = abs.body.reduce(self);
                    return abs;
                };
                return self;
            }
        }
    };

    ns.Parser = {
        JS: function() {
            var self = {};
            self.parse = function(text) {
                return (text||'')
                    .replace(new RegExp('//.*[\r\n]', 'g'), '')
                    .replace(/[\r\n\t]/g, ' ')
                    .replace(new RegExp('/\\*.*?\\*/', 'g'), '')
                    .split(/;/).map(function(l) {
                        return self.parseLine(l);
                    }).filter(function(l) { return !/^\s*$/.test(l) });
            };
            self.parseLine = function(line) {
                line = line.replace(/^\s*/, '').replace(/\s*$/, '');
                if (/;/.test(line.charAt(line.length-1))) {
                    line = line.substring(0, line.length-1);
                }
                return line.length ? self.parseExpr(line)+';' : '';
            };
            self.parseExpr = function(str) {
                var arr = [];
                while (str.length) {
                    var first = str.charAt(0);
                    if (/[({[]/.test(first)) {
                        var index = self.matchParen(str);
                        arr.push(first,
                                 self.parseExpr(str.substring(1, index)),
                                 str.charAt(index));
                        str = str.substring(index+1);
                    } else if (/^function\(([^)]*)\)(.*)$/.test(str)) {
                        var args = RegExp.$1;
                        var body = RegExp.$2;
                        escaped = args.split(/,/).map(function(arg) {
                            arg = arg.replace(/^\s*/, '').replace(/\s*$/, '');
                            return "'"+arg+"'";
                        });
                        // TODO: check if escaped.length == 1
                        arr.push('fun('+escaped[0]+",",
                                 'function(', args, ')',
                                 self.parseExpr(body), ')');
                        str = '';
                    } else {
                        arr.push(first);
                        str = str.substring(1);
                    }
                }
                return arr.join('');
            };
            self.matchParen = function(str) {
                var paren = { '[': ']', '(': ')', '{': '}' };
                var open = str.charAt(0);
                var close = paren[open];
                var depth = 0;
                if (!close) return str.length;
                for (var i=0; i<str.length; i++) {
                    if (str.charAt(i) == close) {
                        if (--depth == 0) return i;
                    } else if (str.charAt(i) == open) {
                        depth++;
                    }
                }
                return str.length;
            };
            return self;
        },
        Lambda: function() {
        }
    };

    ns.PP = {
        JS: function() {
        },
        Lambda: function() {
        }
    };
})(LambdaJS);

function run(id) {
    var code = document.getElementById(id);

    var parser = new LambdaJS.Parser.JS();
    var parsed = parser.parse(code.textContent);
    var sandbox = new LambdaJS.Sandbox();

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Semantics.Strategy.CallByName();
        exp = exp.reduce(st);
        if (!st.reduced) break;
    }

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Semantics.Strategy.CallByValue();
        exp = exp.reduce(st);
        if (!st.reduced) break;
    }

    var exp = sandbox.run(parsed.join(''));

    code.appendChild(document.createElement('br'));
    while (true) {
        code.appendChild(document.createElement('br'));
        code.appendChild(document.createTextNode((exp||'').toString()));
        if (typeof exp == 'undefined') break;

        var st = new LambdaJS.Semantics.Strategy.NormalOrder();
        exp = exp.reduce(st);
        if (!st.reduced) break;
    }
};

function init() {
    var links = document.getElementsByTagName('a');
    for (var i=0; i < links.length; i++) {
        if (links[i].id.match(/^run-.+/)) {
            var href = "javascript:run('$1')";
            links[i].href = links[i].id.replace(/^run-(.+)$/, href);
        }
    }
};
