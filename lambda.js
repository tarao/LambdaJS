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
        var Tokens = function(tokens) {
            var self = { tokens: tokens||[] };
            self.push = function(t) {
                if (t != 'fun' && self.tokens.indexOf(t) == -1 &&
                    Tokens.keywords.indexOf(t) == -1) {
                    try {
                        new ns.Sandbox().run(['var',t,'=','1;'].join(' '));
                        self.tokens.push(t);
                    } catch (e) {
                        Tokens.keywords.push(t);
                    }
                }
                return self;
            };
            self.parse = function(str) {
                while (str.length &&
                       /([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)$/.test(str)) {
                    str = RegExp.$2;
                    self.push(RegExp.$1);
                }
                return self;
            };
            self.toCode = function() {
                return self.tokens.map(function(t) {
                    var a = ['var',t,'=','LambdaJS.Util.promote(\''+t+'\');'];
                    return a.join(' ');
                });
            };
            return self;
        };
        Tokens.keywords = [];
        var self = {
            parser: new ns.Parser(),
            sandbox: new ns.Sandbox(),
            stack: [], predefs: new Tokens()
        };
        self.evalResolvingReference = function(code) {
            self.predefs.parse(code);
            var predefs = self.predefs.toCode();
            return self.sandbox.run(predefs.concat([code]).join('\n'));
        };
        self.evalCode = function(code) {
            var joined = self.stack.concat([code]).join('\n');
            var ret = self.evalResolvingReference(joined);
            if (typeof ret == 'undefined') {
                self.stack.push(code);
            }
            return ret;
        };
        self.evalLine = function(line) {
            line = self.parser.parseLine(line);
            return self.evalCode(line);
        };
        self.evalLines = function(lines) {
            lines = self.parser.parse(lines);
            return lines.reduce(function(r,l){return self.evalCode(l);}, null);
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
                    return this.freshVar(used, 'a'+(num+1));
                } else {
                    return this.freshVar(used, String.fromCharCode(code)+num);
                }
            } else {
                return this.freshVar(used, 'a');
            }
        }
    };

    ns.Ast = function(type, args) {
        var self = function(arg) {
            return new ns.Semantics.App(self, ns.Util.promote(arg).clone());
        };
        self.type = type;
        switch (type) {
        case 'Abs':
            self.arg = ns.Util.promote(args[0]);
            self.body = args[1].call(null, new ns.Semantics.Var(args[0]));
            break;
        case 'App':
            self.fun = args[0];
            self.arg = args[1];
            break;
        case 'Var':
            self.v = args[0];
            break;
        }
        return self;
    };

    ns.Semantics = {
        Base: function(type, args) {
            var self =  ns.Ast(type, args);
            [ 'mark', 'reduceMarked', 'pp' ].forEach(function(m) {
                self[m] = function(visitor) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    args = [ self ].concat(args);
                    var id = function(x){ return x; };
                    return (visitor[m+self.type]||id).apply(visitor, args);
                };
            });
            return self;
        },
        Abs: function(arg, func) {
            var self = ns.Semantics.Base('Abs', arguments);
            self.clone = function() {
                var c = new ns.Semantics.Abs(self.arg.clone(), function() {
                    return self.body.clone();
                });
                c.marked = self.marked;
                c.redex = self.redex;
                return c;
            };
            self.subst = function(arg, v) { // (\x.M)[v:=N]
                if (v.v == self.arg.v)      // (\x.M)[x:=N] = \x.M
                    return { exp: self };
                var fv1 = self.body.fv();   // fv(M)
                var fv2 = arg.fv();         // fv(N)
                var abs = self;
                var alpha;
                if (fv1[v.v||self.arg.v] && fv2[self.arg.v]) {
                    // alpha conversion
                    fv2[v.v||self.arg.v] = true;
                    var fresh = ns.Util.freshVar(fv2, 'a');
                    abs.body = abs.body.subst(fresh, abs.arg).exp;
                    abs.arg = abs.arg.subst(fresh, abs.arg).exp;
                    alpha = abs.clone();
                }
                abs.body = abs.body.subst(arg.clone(), v).exp;
                return {
                    alpha: alpha,
                    exp: abs
                };
            };
            self.fv = function() {
                var fv = self.body.fv();
                fv[self.arg.v] = false;
                return fv;
            };
            self.isEtaRedex = function() {
                var abs = self;
                if (abs.body.type != 'App') return false;
                if (abs.body.arg.type != 'Var') return false;
                if (abs.arg.v != abs.body.arg.v) return false;
                var fv = abs.body.fun.fv();
                if (fv[abs.arg.v]) return false;
                return true;
            };
            return self;
        },
        App: function(func, arg) {
            var self = ns.Semantics.Base('App', arguments);
            self.clone = function() {
                var c = new ns.Semantics.App(self.fun.clone(),
                                             self.arg.clone());
                c.marked = self.marked;
                c.redex = self.redex;
                return c;
            };
            self.subst = function(m, v) {
                var app = self;
                var fun = app.fun.subst(m, v);
                var arg = app.arg.subst(m.clone(), v);
                var alpha;
                if (fun.alpha || arg.alpha) {
                    alpha = app.clone();
                    alpha.fun = fun.alpha || app.fun.clone();
                    alpha.arg = arg.alpha || app.arg.clone()
                }
                app.fun = fun.exp;
                app.arg = arg.exp;
                return {
                    alpha: alpha,
                    exp: app
                };
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
                return { exp: self.v == v.v ?  arg : self };
            };
            self.fv = function() {
                var fv = {};
                fv[self.v] = true;
                return fv;
            };
            return self;
        }
    };

    var Strategy = {
        Base: function() {
            var self = { reduced: null };
            self.name = '(base)';
            self.reduce = function(exp) {
                return self.reduceMarked(self.mark(exp));
            };
            self.mark = function(exp, allowEta) {
                self.marked = false;
                return self._mark(exp, allowEta);
            };
            self._mark = function(exp, allowEta) {
                return ns.Util.promote(exp).mark(self, allowEta);
            };
            self.reduceMarked = function(exp) {
                self.reduced = null;
                self.alpha = null;
                return self._reduceMarked(exp);
            };
            self._reduceMarked = function(exp) {
                return ns.Util.promote(exp).reduceMarked(self);
            };
            self.reduceMarkedAbs = function(abs) {
                if (abs.marked) {
                    // eta reduction
                    self.reduced = 'eta';
                    return abs.body.fun;
                }

                abs.body = self._reduceMarked(abs.body);
                if (self.alpha) {
                    var alpha = self.alpha;
                    self.alpha = abs.clone();
                    self.alpha.body = alpha;
                }
                return abs;
            };
            self.reduceMarkedApp = function(app) {
                var clone = app.clone();
                app.fun = self._reduceMarked(app.fun);
                app.arg = self._reduceMarked(app.arg);
                if (app.marked) {
                    // beta reduction
                    var reduced = app.fun.body.subst(app.arg, app.fun.arg);
                    self.reduced = 'beta';
                    if (reduced.alpha) {
                        clone.fun.body = reduced.alpha;
                        self.alpha = clone;
                    }
                    return reduced.exp;
                }
                return app;
            };
            return self;
        },
        Applicative: {
            markApp: function(app, allowEta) {
                app.fun = this._mark(app.fun, allowEta);
                if (this.marked) return app;

                app.arg = this._mark(app.arg, allowEta);
                if (this.marked) return app;

                if (app.fun.type == 'Abs') {
                    this.marked = true;
                    app.marked = true;
                }

                return app;
            }
        }
    };
    ns.Strategy = {
        LeftmostOutermost: function() {
            var self = new Strategy.Base();
            self.name = 'leftmost outermost';
            self.markAbs = function(abs, allowEta) {
                if (allowEta && abs.isEtaRedex()) {
                    self.marked = true;
                    abs.marked = true;
                    return abs;
                }
                abs.body = self._mark(abs.body, allowEta);
                return abs;
            };
            self.markApp = function(app, allowEta) {
                if (app.fun.type == 'Abs') {
                    self.marked = true;
                    app.marked = true;
                } else {
                    app.fun = self._mark(app.fun, allowEta);
                    if (!self.marked) app.arg = self._mark(app.arg, allowEta);
                }
                return app;
            };
            return self;
        },
        LeftmostInnermost: function() {
            var self = new ns.Strategy.LeftmostOutermost();
            self.name = 'leftmost innermost';
            self.markApp = Strategy.Applicative.markApp;
            return self;
        },
        CallByName: function() {
            var self = new Strategy.Base();
            self.name = 'call by name';
            self.markAbs = function(abs, allowEta) {
                if (!allowEta) return abs;
                if (abs.isEtaRedex()) {
                    self.marked = true;
                    abs.marked = true;
                }
                return abs;
            };
            self.markApp = function(app, allowEta) {
                app.fun = self._mark(app.fun, allowEta);
                if (self.marked) return app;

                if (app.fun.type == 'Abs') {
                    self.marked = true;
                    app.marked = true;
                    return app;
                }

                if (!self.marked) app.arg = self._mark(app.arg, allowEta);

                return app;
            };
            return self;
        },
        CallByValue: function() {
            var self = new ns.Strategy.CallByName();
            self.name = 'call by value';
            self.markApp = Strategy.Applicative.markApp;
            return self;
        },
        Manual: function() {
            var self = new Strategy.Base();
            self.name = 'manual';
            self.markAbs = function(abs, allowEta) {
                abs.redex = false;
                abs.body = self._mark(abs.body, allowEta);
                if (allowEta && abs.isEtaRedex()) {
                    self.marked = true;
                    abs.redex = true;
                    return abs;
                }
                return abs;
            };
            self.markApp = function(app, allowEta) {
                app.redex = false;
                if (app.fun.type == 'Abs') {
                    self.marked = true;
                    app.redex = true;
                }
                app.fun = self._mark(app.fun, allowEta);
                app.arg = self._mark(app.arg, allowEta);
                return app;
            };
            var reduceMarked = self.reduceMarked;
            self.reduceMarked = function(exp) {
                var r = reduceMarked.call(self, exp);
                self.mark(exp);
                return r;
            };
            return self;
        }
    };

    ns.Parser = function() {
        var self = {};
        self.parse = function(text) {
            return (text||'')
                .replace(new RegExp('//.*?[\r\n]', 'g'), '')
                .replace(/[\r\n\t]/g, ' ')
                .replace(new RegExp('/\\*.*?\\*/', 'g'), '')
                .split(/;/).map(function(l) {
                    return self.parseLine(l);
                }).filter(function(l) { return !/^\s*$/.test(l) });
        };
        self.parseLine = function(line) {
            if (new RegExp('^(.*?)//.*$').test(line)) {
                line = RegExp.$1;
            }
            line = line.replace(/^\s*/, '').replace(/\s*$/, '');
            if (/;/.test(line.charAt(line.length-1))) {
                line = line.substring(0, line.length-1);
            }
            if (line.length && !new RegExp('^(let|var)').test(line)) {
                line = '('+line+')';
            }
            return line.length ? self.parseExpr(line)+';' : '';
        };
        self.parseExpr = function(str, nest) {
            var arr = [];
            var app = false;
            var rec = function(str) {
                return self.parseExpr(str.replace(/^\s+/, ''), true);
            };
            while (str.length) {
                var first = str.charAt(0);
                if (/[\(\{\[]/.test(first)) {
                    var index = self.matchParen(str);
                    arr.push([
                        first, rec(str.substring(1, index)), str.charAt(index)
                    ].join(''));
                    str = str.substring(index+1);
                } else if (/^function\s*\(([^\)]*)\)(.*)$/.test(str)) {
                    var args = RegExp.$1;
                    var body = RegExp.$2;
                    escaped = args.split(/,/).map(function(arg) {
                        arg = arg.replace(/^\s*/, '').replace(/\s*$/, '');
                        return "'"+arg+"'";
                    });
                    arr.push([
                        'fun(['+escaped.join(',')+'],',
                        'function(', args, ') ',
                        rec(body), ')'
                    ].join(''));
                    str = '';
                } else if (/^return([^\w].*)$/.test(str)) {
                    arr.push([
                        'return ', rec(RegExp.$1)
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
                } else if (/^([^(){}[\]\s]+)(.*)$/.test(str)) {
                    var token = RegExp.$1;
                    str = RegExp.$2;
                    if (/^(.*?)(function[^\w].*|return[^\w].*)$/.test(token)) {
                        token = RegExp.$1;
                        str = RegExp.$2 + str;
                    }
                    arr.push(token);
                } else {
                    throw { message: 'syntax error' };
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
