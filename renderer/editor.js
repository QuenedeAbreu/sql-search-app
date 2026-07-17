let editor;
self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    return '../node_modules/monaco-editor/min/vs/base/worker/workerMain.js';
  }
};

require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {

  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true
  });

  window.editorInstance = editor;
});


// require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });

// require(['vs/editor/editor.main'], function () {
//   editor = monaco.editor.create(document.getElementById('editor'), {
//     value: '',
//     language: 'sql',
//     theme: 'vs-dark',
//     automaticLayout: true
//   });

//   window.editorInstance = editor;
// });
