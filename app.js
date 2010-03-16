if (typeof LambdaJS == 'undefined') var LambdaJS = {};
if (typeof LambdaJS.App == 'undefined') LambdaJS.App = {};

(function(ns) {
    ns.testJS18 = function() {
        return [
            '(function(x) x)(1)',
            'let x = 1'
        ].every(function(t) {
            try {
                eval(t);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
    ns.isJS18Enabled = function() {
        if (typeof ns._isJS18Enabled == 'undefined') {
            ns._isJS18Enabled = ns.testJS18();
        }
        return ns._isJS18Enabled;
    };
    ns.hideSyntax = function(table, hide) {
        var hideCols = function(table, i) {
            for (var j=0; j < table.rows.length; j++) {
                var row = table.rows[j];
                if (row) {
                    var elm = row.cells[i];
                    if (elm) elm.style.display = 'none';
                }
            }
        };
        var head = table.rows[0];
        if (!head) return;
        for (var i=0; i < head.cells.length; i++) {
            if (head.cells[i].className == hide) {
                hideCols(table, i);
                break;
            }
        }
    };
    ns.Selector = function(cat, action, dflt) {
        var self = { hash: {} };
        for (var key in LambdaJS[cat]) {
            var obj = new LambdaJS[cat][key]();
            self.hash[obj.name] = { key: key };
        }
        var name = cat.toLowerCase();
        with (UI) {
            var ul = $(name);
            for (var label in self.hash) {
                var key = self.hash[label].key;
                var selected = (key==dflt || label==dflt);
                var a = $new('a', { child: label }); a.href = '.';
                var li = $new('li', {
                    id: name+key, klass: selected ? 'selected' : '', child: a
                });
                self.hash[label].li = li;
                ul.appendChild(li);
                if (selected) action(key);
                addEvent(a, 'onclick', (function(li) {
                    return function(e) {
                        for (var label in self.hash) {
                            if (label == li.textContent) {
                                li.className = 'selected';
                                action(self.hash[label].key);
                            } else {
                                self.hash[label].li.className = '';
                            }
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    };
                })(li));
            }
            return self;
        }
    };
    ns.AbortButton = function(parent, style, callback) {
        var self = function(){ return self.aborted; };
        self.aborted = false;
        self.button = UI.$new('a', { klass: 'abort', style: style, child: [
            UI.$new('span', { klass: 'icon', child: '\u2716' }),
            'abort'
        ] });
        parent.appendChild(self.button);
        UI.addEvent(self.button, 'onclick', function() {
            self.aborted=true;
            callback();
        });
        self.die = function() {
            if (!self.died) parent.removeChild(self.button);
            self.died = true;
        };
        return self;
    };
    ns.Repl = function(elm) {
        var self = {
            getWait: function(){ return 500; },
            getStrategy: function() {
                return new LambdaJS.Strategy.Leftmost();
            },
            getPP: function() {
                return new LambdaJS.PP.Lambda();
            },
            cont: function() {
                self.console.prompt();
                if (self.abort) self.abort.die();
            },
            env: new LambdaJS.Env()
        };
        self.makeAbortButton = function() {
            var parent = self.console.view.parentNode;
            var pos = UI.getPosition(parent);
            self.abort = new ns.AbortButton(parent, {
                position: 'absolute'
            }, function() {
                if (self.marker) {
                    self.marker.setCallback(function(){});
                    self.marker = null;
                }
                self.cont();
            });
            pos.x += parent.offsetWidth-self.abort.button.offsetWidth;
            pos.y += parent.offsetHeight;
            self.abort.button.style.left = pos.x+'px';
            self.abort.button.style.top = pos.y+'px';
        };
        self.console = new UI.Console(elm, function(cmd) {
            self.sandbox(function() {
                self.exp = self.env.evalLine(cmd);
                if (self.exp) {
                    self.strategy = self.getStrategy();
                    self.console.insert(self.getPP().pp(self.exp));
                    self.makeAbortButton();
                    self.mark();
                } else {
                    self.cont();
                }
                return true;
            }, self.cont);
        });
        self.sandbox = function(fun, cont) {
            try {
                if (fun()) return;
            } catch (e) {
                var meta = [];
                [ 'fileName', 'lineNumber' ].forEach(function(x) {
                    if (/^([a-z]+)/.test(x) && e[x])
                        meta.push(RegExp.$1 + ': ' + e[x]);
                });
                meta = meta.length ? ' ['+meta.join(', ')+']' : '';
                self.console.err(e.message + meta);
            }
            cont();
        };
        self.mark = function() {
            self.sandbox(function() {
                var strategy = self.getStrategy();
                self.exp = strategy.mark(self.exp);
                if (strategy.marked) {
                    setTimeout(function() {
                        if (self.abort()) return;
                        self.marker = self.getPP();
                        UI.replaceLastChild(self.console.view.lastChild,
                                            self.marker.pp(self.exp));
                        self.reduce(self.marker);
                    }, self.getWait());
                    return true;
                }
            }, self.cont);
        };
        self.reduce = function(marker) {
            self.sandbox(function() {
                var strategy = self.getStrategy();
                self.exp = strategy.reduceMarked(self.exp);
                if (strategy.reduced) {
                    var red = UI.$new('span', {
                        klass: 'reduce',
                        child: '\u2192'
                    });
                    setTimeout(function() {
                        if (self.abort()) return;
                        self.console.insert(red, self.marker.pp(self.exp));
                        self.mark();
                    }, self.getWait());
                } else {
                    marker.setCallback(function(){ self.mark(); });
                }
                return true;
            }, self.cont);
        };
        self.cont();
        return self;
    };
})(LambdaJS.App);

function init(id) {
    with (LambdaJS.App) {
        // hide unsupported syntax
        hideSyntax(document.getElementById('syntax'),
                   isJS18Enabled() ? 'javascript' : 'javascript18');

        // REPL
        var elm = document.getElementById(id);
        var repl = new Repl(elm);

        // strategy
        new Selector('Strategy', function(key) {
            repl.getStrategy = function() {
                return new LambdaJS.Strategy[key];
            };
            UI.$('input-strategy').value = key;
            if (repl.console.input) repl.console.input.focus();
        }, UI.$('input-strategy').value || 'Leftmost');

        // output
        if (!isJS18Enabled()) delete LambdaJS.PP.JavaScript18;
        new Selector('PP', function(key) {
            repl.getPP = function() {
                return new LambdaJS.PP[key];
            };
            UI.$('input-pp').value = key;
            if (repl.console.input) repl.console.input.focus();
        }, UI.$('input-pp').value || 'JavaScript');

        // wait
        var ul = UI.$('pp');
        ul.appendChild(UI.$new('li', { klass: 'label', child: 'Wait:' }));
        var input = UI.$new('input', { id: 'wait' });
        var sync = function(){ UI.$('input-wait').value = input.value; };
        UI.addEvent(input, 'onchange', sync);
        UI.addEvent(input, 'onkeyup', sync);
        var w = UI.$('input-wait').value;
        input.value = w.length ? w : 500;
        sync();
        ul.appendChild(input);
        repl.getWait = function(){ return input.value; };
    }
};
