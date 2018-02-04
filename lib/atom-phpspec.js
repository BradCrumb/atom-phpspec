'use babel';

import AtomPhpspecView from './atom-phpspec-view';
import { CompositeDisposable } from 'atom';
import child_process from 'child_process';

export default {

    config: {
      saveBeforeTest: {
        order: 1,
        description: 'Save current file before running test(s)',
        type: 'boolean',
        default: true
      },
      successAsNotifications: {
        order: 2,
        description: 'Show successful output as a notification instead of using the output panel',
        type: 'boolean',
        default: true
      },
      failuresAsNotifications: {
        order: 3,
        description: 'Show failures output as a notification instead of using the output panel',
        type: 'boolean',
        default: false
      },
      useVendor: {
        order: 4,
        description: 'Uses the project\'s phpspec binary (./vendor/bin/phpspec)',
        type: 'boolean',
        default: true
      },
      phpspecPath: {
        order: 5,
        title: 'phpspec Binary Path',
        description: 'Used only if \'Use Vendor\' is not ticked.',
        type: 'string',
        default: '/usr/local/bin/phpspec'
      },
      outputViewFontSize: {
        order: 6,
        title: 'Output View Font Size',
        description: 'Set the font size of the phpspec Output view',
        type: 'string',
        default: '14px'
      },
      usePhpdbg: {
        order: 7,
        description: 'Make use of phpdbg instead of regular php with xdebug',
        type: 'boolean',
        default: false
      },
      phpdbgPath: {
        order: 8,
        title: 'phpdbg Binary Path',
        description: 'With phpdbg specs run much faster then with regular php and xdebug',
        type: 'string',
        default: '/usr/bin/phpdbg'
      },
  },

  errorView: null,
  //modalPanel: null,
  outputPanel: null,
  subscriptions: null,
  exec: null,

  activate(state) {
    this.exec = child_process.exec;
    this.errorView = new AtomPhpspecView(state.atomPhpspecViewState);
    // this.modalPanel = atom.workspace.addModalPanel({
    //   item: this.atomPhpspecView.getElement(),
    //   visible: false
    // });

    this.outputPanel = atom.workspace.addBottomPanel({
      item: this.errorView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-phpspec:toggle': () => this.toggle(),
      'atom-phpspec:run-class': () => this.runClass(),
      'atom-phpspec:toggle-output': () => this.toggleOutput()
    }));
  },

  deactivate() {
    //this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.outputPanel.destroy();
    this.errorView.destroy();
  },

  serialize() {
    return {
      atomPhpspecViewState: this.errorView.serialize()
    };
  },

  toggle() {
    console.log('AtomPhpspec was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  },

  runClass() {
    if (this.outputPanel.isVisible()) {
      this.errorView.update('No Output');
      this.outputPanel.hide();
    }
    filepath = this.getFilepath();
    if (!filepath) {
      atom.notifications.addError('Failed to get filename! Make sure you are in the test file you want run.');
      return;
    }

    this.run(filepath);
  },

  toggleOutput() {
    this.outputPanel.isVisible()
      ? this.outputPanel.hide()
      : this.outputPanel.show();
  },

  run(filepath) {
    if (
      atom.config.get('atom-phpunit.saveBeforeTest') &&
      atom.workspace.getActiveTextEditor().isModified()
    ) {
        atom.workspace.getActiveTextEditor().save();
    }

    cmd = this.getBinary();

    cmd += ` run`;

    if (typeof filepath !== 'undefined')
      cmd += ` ${filepath}`;

    console.log(`atom-phpspec: ${cmd}`);

    const phpspec = this.exec(cmd, {cwd: this.getProjectFolderPath()});

    let stdout = "";
    let stderr = "";

    phpspec.stdout.on("data", (data) => {
      stdout += data.toString();

      this.errorView.update(stdout, false);
    });

    phpspec.stderr.on("data", (data) => {
      stderr += data.toString();

      this.errorView.update(stderr, false);
    });

    phpspec.on('exit', (code) => {
      const error = code.toString() !== '0';

      if (error && stderr) {
        this.errorView.update(stderr, cmd, false);
        this.outputPanel.show();
      } else if (error) {
        this.errorView.update(stdout, cmd, false);
        if (atom.config.get('atom-phpspec.failuresAsNotifications')) {
          atom.notifications.addError('Test Failed!', {description: cmd, detail: stdout});
        } else {
          this.outputPanel.show();
        }
      } else {
        this.errorView.update(stdout, cmd, true);
        if (atom.config.get('atom-phpspec.successAsNotifications')) {
          atom.notifications.addSuccess('Test Passed!', {description: cmd, detail: stdout});
        } else {
          this.outputPanel.show();
        }
      }
    });
  },

  getBinary() {
    cmd = atom.config.get('atom-phpspec.phpspecPath');

    if (atom.config.get('atom-phpspec.useVendor')) {
      cmd = './vendor/bin/phpspec';
    }

    if (atom.config.get('atom-phpspec.usePhpdbg')) {
        cmd = atom.config.get('atom-phpspec.phpdbgPath') + ' -qrr ' + cmd;
    }

    return cmd;
  },

  getFilepath() {
    let editor = atom.workspace.getActivePaneItem();
    if (!editor)
      return false;

    let buffer = editor.buffer;
    if (!buffer)
      return false;

    let file = buffer.file;

    if (!file) {
      return false;
    }

    if (!file.path) {
      return false;
    }

    return file.path;
  },

  getProjectFolderPath() {
    return atom.project.relativizePath(this.getFilepath())[0];
  }
};
