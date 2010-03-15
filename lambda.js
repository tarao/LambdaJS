/*
  TODO:
  - interactive UI
  -- resizer on console
  -- manual mode (strategy which requires user to choose redex)
  -- abort button
  -- mark alpha conversion?
  - test in other browsers
*/

if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    ns.Sandbox = function() {
        var window = null;
        var document = null;
        var alert = null;
        this.fun = ns.Parser.makeFun;
        this.run = function(code){ with (this) return eval(code); };
    };

    ns.Env = function() {
        var self = {
            parser: new ns.Parser(),
            sandbox: new ns.Sandbox(),
            stack: []
        };
        self.evalResolvingReference = function(line) {
            while (true) {
                try {
                    return self.sandbox.run(line);
                } catch (e) {
                    if (/^([^\s]+) is not defined$/.test(e.message)) {
                        line = [
                            [ 'var', RegExp.$1, '=',
                              "LambdaJS.Util.promote('"+RegExp.$1+"');"
                            ].join(' '),
                            line
                        ].join("\n");
                    } else {
                        throw { message: e.message };
                    }
                }
            }
        };
        self.evalLine = function(line) {
            line = self.parser.parseLine(line);
            var code = self.stack.concat([line]).join("\n");
            var ret = self.evalResolvingReference(code);
            if (typeof ret == 'undefined') {
                self.stack.push(line);
            }
            return ret;
        };
        return self;
    };

    ns.Util = {
        promote: function(v) {
            if (['Abs', 'App', 'Var'].indexOf(v.type||'') == -1) {
                return new ns.Semantics.Var(v);
            }
            return v;
        },
        freshVar: function(used, v) {
            if (!used[v]) return ns.Util.promote(v);
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
        }
    };

    ns.Ast = function(type, args) {
        var self = function(arg) {
            return new ns.Semantics.App(self, arg);
        };
        self.type = type;
        if (type == 'Abs') {
            self.body = args[1].call(null, new ns.Semantics.Var(args[0]));
            self.arg = ns.Util.promote(args[0]);
        } else if (type == 'App') {
            self.fun = args[0];
            self.arg = ns.Util.promote(args[1]);
        } else if (type == 'Var') {
            self.v = args[0];
        }
        return self;
    };

    ns.Semantics = {
        Base: function(type, args) {
            var self =  ns.Ast(type, args);
            [ 'mark', 'reduceMarked', 'pp' ].forEach(function(m) {
                self[m] = function(visitor) {
                    var id = function(x){ return x; };
                    return (visitor[m+self.type]||id)(self);
                }
            });
            return self;
        },
        Abs: function(arg, func) {
            var self = ns.Semantics.Base('Abs', arguments);
            self.clone = function() {
                return new ns.Semantics.Abs(self.arg.clone(), function() {
                    return self.body.clone();
                });
            };
            self.subst = function(arg, v) {         // (\x.M)[v:=N]
                if (v.v == self.arg.v) return self; // (\x.M)[x:=N] = \x.M
                var fv1 = self.body.fv();   // fv(M)
                var fv2 = arg.fv();         // fv(N)
                var abs = self.clone();
                if (fv1[v.v||self.arg.v] && fv2[self.arg.v]) {
                    // alpha conversion
                    fv2[v.v||self.arg.v] = true;
                    var fresh = ns.Util.freshVar(fv2, 'a');
                    abs.body = abs.body.subst(fresh, abs.arg);
                    abs.arg = abs.arg.subst(fresh, abs.arg);
                }
                abs.body = abs.body.subst(arg, v);
                return abs;
            };
            self.fv = function() {
                var fv = self.body.fv();
                fv[self.arg.v] = false;
                return fv;
            };
            return self;
        },
        App: function(func, arg) {
            var self = ns.Semantics.Base('App', arguments);
            self.clone = function() {
                return new ns.Semantics.App(self.fun.clone(),
                                            self.arg.clone());
            };
            self.subst = function(arg, v) {
                var app = self.clone();
                app.fun = app.fun.subst(arg, v);
                app.arg = app.arg.subst(arg, v);
                return app;
            };
            self.fv = function() {
                var fv1 = self.fun.fv();
                var fv2 = self.arg.fv();
                for (var p in fv1) fv2[p] = fv2[p] || fv1[p];
                return fv2;
            };
            return self;
        },
        Var: function(v) {
            var self = ns.Semantics.Base('Var', arguments);
            self.clone = function() {
                return new ns.Semantics.Var(self.v+'');
            };
            self.subst = function(arg, v) {
                return self.v == v.v ?  arg : self;
            };
            self.fv = function() {
                var fv = {};
                fv[self.v] = true;
                return fv;
            };
            return self;
        }
    };

    ns.Strategy = {
        Leftmost: function() {
            var self = new ns.Strategy.CallByName();
            self.name = 'leftmost';
            self.markAbs = function(abs) {
                abs = abs.clone();
                abs.body = self._mark(abs.body);
                return abs;
            };
            self.markApp = function(app) {
                app = app.clone();
                if (app.fun.type == 'Abs') {
                    self.marked = true;
                    app.redex = true;
                } else {
                    app.fun = self._mark(app.fun);
                    if (!self.marked) app.arg = self._mark(app.arg);
                }
                return app;
            };
            return self;
        },
        CallByName: function() {
            var self = { reduced: false };
            self.name = 'call by name';
            self.reduce = function(exp) {
                return self.reduceMarked(self.mark(exp));
            };
            self.mark = function(exp) {
                self.marked = false;
                return self._mark(exp);
            };
            self._mark = function(exp) {
                return ns.Util.promote(exp).mark(self);
            };
            self.markApp = function(app) {
                app = app.clone();
                app.fun = self._mark(app.fun);
                if (app.fun.type != 'Abs') return app;
                if (!self.marked) {
                    app.arg = self.markArg(app.arg);
                }
                if (!self.marked) {
                    self.marked = true;
                    app.redex = true;
                }
                return app;
            };
            self.markArg = function(arg){ return arg; };
            self.reduceMarked = function(exp) {
                self.reduced = false;
                return self._reduceMarked(exp);
            };
            self._reduceMarked = function(exp) {
                return ns.Util.promote(exp).reduceMarked(self);
            };
            self.reduceMarkedAbs = function(abs) {
                abs.body = self._reduceMarked(abs.body);
                return abs;
            };
            self.reduceMarkedApp = function(app) {
                app.fun = self._reduceMarked(app.fun);
                app.arg = self._reduceMarked(app.arg);
                if (app.redex) {
                    self.reduced = true;
                    return app.fun.body.subst(app.arg, app.fun.arg);
                }
                return app;
            };
            return self;
        },
        CallByValue: function() {
            var self = new ns.Strategy.CallByName();
            self.name = 'call by value';
            self.markArg = function(arg){ return self._mark(arg); };
            return self;
        }
    };

    ns.Parser = function() {
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
        self.parseExpr = function(str, nest) {
            var arr = [];
            var app = false;
            var rec = function(str){ return self.parseExpr(str, true); };
            while (str.length) {
                var first = str.charAt(0);
                if (/[({[]/.test(first)) {
                    var index = self.matchParen(str);
                    arr.push([
                        first, rec(str.substring(1, index)), str.charAt(index)
                    ].join(''));
                    str = str.substring(index+1);
                } else if (/^function\s*\(([^)]*)\)(.*)$/.test(str)) {
                    var args = RegExp.$1;
                    var body = RegExp.$2;
                    escaped = args.split(/,/).map(function(arg) {
                        arg = arg.replace(/^\s*/, '').replace(/\s*$/, '');
                        return "'"+arg+"'";
                    });
                    arr.push([
                        'fun(['+escaped.join(',')+"],",
                        'function(', args, ') ',
                        rec(body), ')'
                    ].join(''));
                    str = '';
                } else if (/^return([^\w].*)$/.test(str)) {
                    arr.push([
                        'return', rec(RegExp.$1)
                    ].join(' '));
                    str = '';
                } else if (/^[\u03bb\\](\w+)\.(.*)$/.test(str)) {
                    str = [
                        'function(', RegExp.$1.split('').join(','), '){',
                        'return ', RegExp.$2, '}'
                    ].join('');
                } else if (/^(\s+)(.*)$/.test(str)) {
                    arr.push(RegExp.$1);
                    str = RegExp.$2;
                    if (nest && arr.length > 0) app = true;
                    continue;
                } else if (/^(\S+)(.*)$/.test(str)) {
                    arr.push(RegExp.$1);
                    str = RegExp.$2;
                }
                if (app) {
                    if (arr[arr.length-3] && arr[arr.length-1]) {
                        var arg = arr.pop();
                        arr.pop();
                        var fun = arr.pop();
                        arr.push(fun+'('+arg+')');
                        app = false;
                    }
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
    };
    ns.Parser.makeFun = function(args, f, stack) {
        stack = stack || [];
        var arg = args.shift();
        if (args.length == 0) {
            return new ns.Semantics.Abs(arg, function(x) {
                return f.apply(null, stack.concat([x]));
            });
        } else if (args.length > 0) {
            return new ns.Semantics.Abs(arg, function(x) {
                return ns.Parser.makeFun(args, f, stack.concat([x]));
            });
        }
    };
})(LambdaJS);
