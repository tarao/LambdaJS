if (typeof LambdaJS == 'undefined') var LambdaJS = {};

(function(ns) {
    with (UI) {
        var appendParen = function(node, child) {
            ['(',child,')'].forEach(function(x){node.appendChild($node(x));});
        };
        ns.PP = {
            Lambda: function() {
                self.pp = function(exp){ return $node(self._pp(exp)); };
                self._pp = function(exp){ return exp.pp(self); };
                self.ppApp = function(app) {
                    var fun = app.fun;
                    var arg = app.arg;
                    var klass = 'application';
                    if (app.marked) {
                        klass = [ klass, 'redex' ].join(' ');
                        var fun = app.fun.clone();
                        var bound = app.fun.arg.clone();
                        bound.bound = true;
                        fun.body = fun.body.subst(bound, fun.arg);
                    }
                    var span = $new('span', { klass: klass });
                    fun = self.pp(fun);
                    if (app.fun.type == 'Abs') {
                        appendParen(span, fun);
                    } else {
                        span.appendChild(fun);
                    }
                    span.appendChild($text(' '));
                    arg = self.pp(app.arg);
                    if (app.arg.type != 'Var') {
                        var paren = $new('span', { klass: 'argument' });
                        appendParen(paren, arg);
                        span.appendChild(paren);
                    } else {
                        arg.className += ' argument';
                        span.appendChild(arg);
                    }
                    return span;
                };
                self.ppAbs = function(abs) {
                    var span = $new('span', { klass: 'abstraction' });
                    var lambda = $new('span', {
                        klass: 'lambda',
                        child: '\u03bb'
                    });
                    var arg = self.pp(abs.arg);
                    arg.className += ' binding';
                    var body = self.pp(abs.body);
                    span.appendChild(lambda);
                    span.appendChild(arg);
                    span.appendChild($text('.'));
                    span.appendChild(body);
                    return span;
                };
                self.ppVar = function(v) {
                    var klass = 'variable';
                    if (v.bound) klass = [ klass, 'bound' ].join(' ');
                    var span = $new('span', {
                        klass: klass,
                        child: v.v+''
                    });
                    return span;
                };
                return self;
            },
            JavaScript: function() {
            },
            JavaScript18: function() {
            }
        };
    }
})(LambdaJS);
