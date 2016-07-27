/* eslint-env browser */

'use strict';

// TODO: handle invalid grammar in textbox
// TODO: fix needed eamples bug (need force update to get rid of ident)

(function(root, initModule) {
  if (typeof exports === 'object') {
    module.exports = initModule;
  } else {
    root.exampleWorkerManager = initModule(root.ohm, root.ohmEditor,
                                           root.utils, root.CheckedEmitter);
  }
})(this, function(ohm, ohmEditor, utils, CheckedEmitter) {
  var exampleWorkerManager = new CheckedEmitter();

  exampleWorkerManager.registerEvents({
    'received:examples': ['ruleName', 'examples'],
    'received:neededExamples': ['neededExamples']
  });

  var eventsToEmit = ['received:examples', 'received:neededExamples'];

  var exampleWorker = new Worker('exampleWorker.js');
  /* eslint-disable no-unused-vars */
  var examplesNeeded = null;
  /* eslint-enable no-unused-vars */

  // TODO: may want to reset current worker instead

  var grammar;

  function resetWorker(grammar) {
    if (exampleWorker) {
      exampleWorker.terminate();
    }
    exampleWorker = new Worker('exampleWorker.js');
    exampleWorker.onmessage = onWorkerMessage;
    exampleWorker.postMessage({
      name: 'initialize', recipe: grammar.toRecipe()
    });

    var examples = ohmEditor.examples.getExamples();
    Object.keys(examples).forEach(function(id) {
      var example = examples[id];
      if (example.startRule) {
        var match = grammar.match(example.text, example.startRule);
      } else {
        match = grammar.match(example.text);
      }

      if (match.succeeded()) {
        exampleWorkerManager.addUserExample(example.startRule || grammar.defaultStartRule,
                                            example.text);
      }
    });
  }

  ohmEditor.addListener('parse:grammar', function(_, g, __) {
    grammar = g;
    resetWorker(g);
  });

  ohmEditor.examples.addListener('set:example', function(_, oldValue, newValue) {
    if (newValue.text.trim() === '') {
      return;
    } else if (oldValue && oldValue.text.trim() === '' ||
               !oldValue) {
      var grammar = ohmEditor.grammar;
      if (grammar.match(newValue.text, newValue.startRule).succeeded()) {
        exampleWorkerManager.addUserExample(newValue.startRule || grammar.defaultStartRule,
                                            newValue.text);
      }
    } else {
      resetWorker(grammar);
    }
  });

  ohmEditor.examples.addListener('remove:example', function(_) {
    resetWorker(grammar);
  });

  function onWorkerMessage(event) {
    if (eventsToEmit.includes(event.data.name)) {
      exampleWorkerManager.emit.apply(exampleWorkerManager,
                                      [event.data.name].concat(event.data.args));
    } else {
      /* eslint-disable no-console */
      console.debug('WORKER:', event.data);
      /* eslint-enable no-console */
    }
  }

  exampleWorkerManager.requestExamples = function(ruleName) {
    relayEvent('request:examples', [ruleName]);
  };

  exampleWorkerManager.updateNeededExamples = function() {
    relayEvent('update:neededExamples', []);
  };

  exampleWorkerManager.addUserExample = function(ruleName, example) {
    relayEvent('add:userExample', [ruleName, example]);
  };

  function relayEvent(eventName, args) {
    exampleWorker.postMessage({
      name: eventName,
      args: args
    });
  }

  exampleWorkerManager.neededExamples = null;
  exampleWorkerManager.addListener('received:neededExamples', function(neededExamples) {
    exampleWorkerManager.neededExamples = neededExamples;

  });

  return exampleWorkerManager;
});
