let specId;
let parentWindow;
const noAutoGradrErrorMsg =
  'auto-grading for this assessment is not yet available';
const auditsInstallFailedMsg = 'Unable to load your auto grader. Kindly contact the admin';

const relay = data => {
  parentWindow.postMessage(data, window.location.origin);
};

const executeScript = code =>
  new Promise((resolve, reject) => {
    let ast;
    try {
      ast = esprima.parseScript(code);
    } catch (error) {
      reject(
        Error(
          'Awwww Snaaap :( your javascript code has one or more syntax errors ...'
        )
      );
    }

    if (!ast) return;

    if (typeof gradrInstrumentation !== 'undefined') {
      // TODO rename this to gradrCodemod
      ast = gradrInstrumentation(ast);
    }

    ast.body = ast.body.map(n => {
      const node = n;
      if (node.type === 'VariableDeclaration') {
        node.kind = 'var';
      }
      return node;
    });

    const codeToRun = escodegen.generate(ast);
    const script = document.body.querySelector('#codesink');
    if (script) {
      script.remove();
    }

    const scriptTag = document.createElement('script');
    scriptTag.setAttribute('id', 'codesink');
    scriptTag.textContent = codeToRun;
    document.body.appendChild(scriptTag);
    resolve();
  });

const executeStyle = code =>
  new Promise((resolve, reject) => {
    const styles = document.head.querySelector('#styles');

    csstree.parse(code, {
      onParseError: () => {
        reject(
          Error(
            'Awwww Snaaap :( your CSS code has one or more syntax errors ...'
          )
        );
      }
    });

    styles.textContent = code;
    resolve();
  });

const executeMarkup = code =>
  new Promise(resolve => {
    const wrap = document.querySelector('#markup-wrap');
    wrap.innerHTML = code;
    resolve();
  });

const runAudits = payload => {
  if (typeof gradr === 'undefined') {
    relay({
      feedback: { message: noAutoGradrErrorMsg }
    });
    return;
  }

  if (typeof gradr === 'function') {
    gradr(payload)
      .then(({ completedChallenge }) => {
        const done = completedChallenge + 1;
        const msg = `Greate Job Finishing Challenge ${done}. You have completed this assessment and your performance has been recorded. No further action is required from you. Enjoy your fully functional app!`;
        relay({
          feedback: {
            message: msg,
            completedChallenge
          }
        });
      })
      .catch(({ message }) => {
        relay({
          feedback: { message }
        });
      });
  }
};

const installAutoGrader = event =>
  new Promise(async (resolve, reject) => {
    if (specId) return resolve();

    specId = event.data.spec;
    const autoGradrURL = `${window.location.origin}/mygradr/${specId}.js`;

    try {
      const response = await fetch(autoGradrURL, {
        headers: {
          Accept: 'application/javascript'
        }
      });

      const contentType = response.headers.get('content-type');
      if(!response.ok && contentType.indexOf('javascript') === -1) {
        reject(
          new Error(auditsInstallFailedMsg)
        );
      }

      // install auto-grading script for this assessment
      const script = document.createElement('script');
      script.onload = () => resolve();
      document.body.appendChild(script);
      script.src = `${autoGradrURL}`;

       //setup gradr as a client to the SW
      if(navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'ping'
        });
      }

    } catch (error) {
      reject(
        new Error(auditsInstallFailedMsg)
      );
    }
  });

const playCode = event => {
  parentWindow = window.parent;
  if (event.source !== parentWindow) return;

  const { styles, script, markup } = event.data.payload;
  installAutoGrader(event)
    .then(() => executeMarkup(markup))
    .then(() => executeStyle(styles))
    .then(() => executeScript(script))
    .then(() => runAudits({ styles, markup, script }))
    .catch(({ message }) => {
      relay({
        feedback: { message }
      });
    });
};

window.addEventListener('message', playCode);