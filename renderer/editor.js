let editor;

require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });

require(['vs/editor/editor.main'], function () {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '',
    language: 'sql',
    theme: 'vs-dark',
    automaticLayout: true
  });

  window.editorInstance = editor;
});