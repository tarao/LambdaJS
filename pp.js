if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    with (UI) {
        var append = function(child) { return function(node) {
            node.appendChild($node(child)); return node;
        }; };
        var appendParen = function(child) { return function(node) {
            ['(',child,')'].forEach(function(x){node.appendChild($node(x));});
            return node;
        }; };
        ns.PP = {
            Lambda: function() {
                var self = { name: 'Lambda', callback: function(){} };
                self.setCallback = function(func){ self.callback = func; };
                self.pp = function(exp){ return $node(self._pp(exp)); };
                self._pp = function(exp){ return exp.pp(self); };
                self.lambda = function(argNode, bodyNode) {
                    return function(node) {
                        var lambda = $new('span', {
                            klass: 'lambda',
                            child: '\u03bb'
                        });
                        append(lambda)(node);
                        append(argNode)(node);
                        append('.')(node);
                        return append(bodyNode)(node);
                    };
                };
                self.apply = function(appendFun, appendArg) {
                    return function(node) {
                        appendFun(node);
                        append(' ')(node);
                        return appendArg(node);
                    };
                };
                self.arg = function(arg) {
                    var argNode = self.pp(arg);
                    if (arg.type != 'Var') {
                        var paren = $new('span', { klass: 'argument' });
                        return append(appendParen(argNode)(paren));
                    } else {
                        argNode.className += ' argument';
                        return append(argNode);
                    }
                };
                self.ppApp = function(app) {
                    var fun = app.fun;
                    var arg = app.arg;
                    var klass = 'application';
                    var node;
                    if (app.marked) {
                        node = $new('span', { klass: klass + ' marked' });
                        var bound = app.fun.arg.clone();
                        bound.bound = true;
                        fun.body = fun.body.subst(bound, fun.arg);
                    } else if (app.redex) {
                        node = $new('a', { klass: klass + ' redex' });
                        UI.addEvent(node, 'onclick', function(e) {
                            app.marked = true;
                            self.callback();
                            self.callback = function(){};
                            e.preventDefault();
                            e.stopPropagation();
                        });
                    } else {
                        node = $new('span', { klass: klass });
                    }
                    fun = self.pp(fun);
                    var appendFun = (app.fun.type == 'Abs') ?
                        appendParen(fun) : append(fun);
                    var appendArg = self.arg(app.arg);
                    return self.apply(appendFun, appendArg)(node);
                };
                self.ppAbs = function(abs) {
                    var arg = self.pp(abs.arg);
                    arg.className += ' binding';
                    return self.lambda(arg, self.pp(abs.body))($new('span', {
                        klass: 'abstraction'
                    }));
                };
                self.ppVar = function(v) {
                    var klass = 'variable';
                    if (v.bound) klass = [ klass, 'bound' ].join(' ');
                    var span = $new('span', {
                        klass: klass, child: v.v+''
                    });
                    return span;
                };
                return self;
            },
            JavaScript: function() {
                var self = ns.PP.Lambda();
                self.name = 'JavaScript';
                self.lambda = function(argNode, bodyNode) {
                    return function(node) {
                        var lambda = $new('span', {
                            klass: 'lambda', child: 'function'
                        });
                        append(lambda)(node);
                        append('(')(node);
                        append(argNode)(node);
                        append(')')(node);
                        return self.body(bodyNode)(node);
                    };
                };
                self.body = function(bodyNode) { return function(node) {
                    append('{ return ')(node);
                    append(bodyNode)(node);
                    return append(' }')(node);
                }; };
                self.apply = function(appendFun, appendArg) {
                    return function(node) {
                        appendFun(node);
                        return appendArg(node);
                    };
                };
                self.arg = function(arg) {
                    var argNode = self.pp(arg);
                    var paren = $new('span', { klass: 'argument' });
                    return append(appendParen(argNode)(paren));
                };
                return self;
            },
            JavaScript18: function() {
                var self = ns.PP.JavaScript();
                self.body = function(bodyNode) { return function(node) {
                    append(' ')(node);
                    return append(bodyNode)(node);
                }; };
                return self;
            }
        };
    }
})(LambdaJS);
