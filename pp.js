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
                var self = ns.PP.Lambda();
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
                var self = ns.PP.JavaScript();
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
                    while (body.type == 'Abs') {
                        args.push(self._pp(body.arg));
                        body = body.body;
                    }
                    return self.lambda(args, self._pp(body))($new('span', {
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
            }
        };
    }
})(LambdaJS);
