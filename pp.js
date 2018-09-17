if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    with (UI) {
        var append = function(child) { return function(node) {
            node.appendChild($node(child)); return node;
        }; };
        var reduce = function() { var args=arguments; return function(node) {
            var arr = []; arr.push.apply(arr, args);
            return arr.reduce(function(a1, a2) {
                return a1.concat((a2 instanceof Array) ? a2 : [a2]);
            }, []).reduce(function(x, f) {
                return ((typeof f == 'function') ? f : append(f))(x);
            }, node);
        }; };
        var appendParen = function(child){ return reduce('(', child, ')'); };
        ns.PP = {
            JavaScript: function() {
                var self = new ns.PP.Lambda();
                self.pp = self._pp;
                self.name = 'JavaScript';
                self.lambda = function(argNodes, bodyNode) {
                    var lambda = $new('span', {
                        klass: 'lambda', child: 'function'
                    });
                    return reduce(lambda, '(', argNodes.shift(),
                                  argNodes.map(function(arg) {
                                      return reduce([ ',', arg ]);
                                  }), ')', self.body(bodyNode));
                };
                self.body = function(bodyNode) {
                    return reduce('{ return ', bodyNode, ' }');
                };
                self.apply = function(fun, arg){ return reduce(fun, arg); };
                self.arg = function(arg) {
                    var argNode = self._pp(arg);
                    var paren = $new('span', { klass: 'argument' });
                    return append(appendParen(argNode)(paren));
                };
                return self;
            },
            JavaScript18: function() {
                var self = new ns.PP.JavaScript();
                self.body = function(body){ return reduce(' ', body); };
                return self;
            },
            Lambda: function() {
                var self = { name: 'Lambda', callback: function(){} };
                self.setCallback = function(func){ self.callback = func; };
                self.pp = function(exp){
                    var node = self._pp(exp);
                    if (exp.type == 'App') {
                        node = $new('span', { child: [ '(', node, ')' ] });
                    }
                    return node;
                };
                self._pp = function(exp) {
                    return $node(LambdaJS.Util.promote(exp).pp(self));
                };
                self.lambda = function(argNodes, bodyNode) {
                    var lambda = $new('span', {
                        klass: 'lambda', child: '\u03bb'
                    });
                    return reduce(lambda, argNodes, '.', bodyNode);
                };
                self.apply = function(fun, arg){ return reduce(fun,' ',arg); };
                self.arg = function(arg) {
                    var argNode = self._pp(arg);
                    if (arg.type != 'Var') {
                        var paren = $new('span', { klass: 'argument' });
                        return append(appendParen(argNode)(paren));
                    } else {
                        argNode.className += ' argument';
                        return append(argNode);
                    }
                };
                self.markBound = function(exp, v) {
                    switch (exp.type) {
                    case 'Var':
                        if (exp.v == v.v) {
                            (exp = exp.clone()).bound=true;
                        }
                        break;
                    case 'App':
                        exp.fun = self.markBound(exp.fun, v);
                        exp.arg = self.markBound(exp.arg, v);
                        break;
                    case 'Abs':
                        if (exp.arg.v != v.v) {
                            exp.body = self.markBound(exp.body, v);
                        }
                        break;
                    }
                    return exp;
                };
                self.ppApp = function(app) {
                    var fun = app.fun;
                    var arg = app.arg;
                    var klass = 'application';
                    var node;
                    if (app.marked) {
                        node = $new('span', { klass: klass + ' marked' });
                        fun.body = self.markBound(fun.body, fun.arg);
                    } else if (app.redex) {
                        node = $new('a', { klass: klass + ' redex shadowed' });
                        new UI.Observer(node, 'onclick', function(e) {
                            app.marked = true;
                            self.callback();
                            self.callback = function(){};
                            e.stop();
                        });
                        new UI.Observer(node, 'onmouseover', function(e) {
                            if (/shadowed/.test(node.className)) {
                                node.className = node.className.split(/\s+/)
                                .filter(function(x){ return x!='shadowed'; })
                                .join(' ');
                            }
                            e.stop();
                        });
                        new UI.Observer(node, 'onmouseout', function(e) {
                            node.className += ' shadowed';
                        });
                    } else {
                        node = $new('span', { klass: klass });
                    }
                    fun = self._pp(fun);
                    var appendFun = (app.fun.type == 'Abs') ?
                        appendParen(fun) : append(fun);
                    var appendArg = self.arg(app.arg);
                    return self.apply(appendFun, appendArg)(node);
                };
                self.ppAbs = function(abs) {
                    var arg = self._pp(abs.arg);
                    arg.className += ' binding';
                    var body = abs.body;
                    var args = [ arg ];

                    var node;
                    var klass = 'abstraction';
                    if (abs.marked) {
                        abs.body = self.markBound(abs.body, abs.arg);
                        node = $new('span', { klass: klass + ' marked' });
                    } else if (abs.redex) {
                        node = $new('a', {
                            klass: klass + ' redex shadowed'
                        });
                        new UI.Observer(node, 'onclick', function(e) {
                            abs.marked = true;
                            self.callback();
                            self.callback = function(){};
                            e.stop();
                        });
                        new UI.Observer(node, 'onmouseover', function(e) {
                            if (/shadowed/.test(node.className)) {
                                node.className = node.className.split(/\s+/)
                                .filter(function(x){ return x!='shadowed'; })
                                .join(' ');
                            }
                            e.stop();
                        });
                        new UI.Observer(node, 'onmouseout', function(e) {
                            node.className += ' shadowed';
                        });
                    } else {
                        while (body.type == 'Abs') {
                            if (body.marked || body.redex) break;
                            args.push(self._pp(body.arg));
                            body = body.body;
                        }
                        node = $new('span', {
                            klass: klass
                        });
                    }
                    return self.lambda(args, self._pp(body))(node);
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
            }
        };
    }
})(LambdaJS);
