import * as firebase from 'firebase/app';
import dotenv from 'dotenv';
import { html, render } from 'lit-html';
import getServerTime from '../../commons/js/getServerTime';

import {
  trim,
  goTo,
  select,
  isAfterKickoffTime,
  loadStylesAndScripts,
  handleWindowPopState,
  selectAll,
  isWithinDeadline
} from '../../commons/js/utils.js';

import {
  importGARelay,
  importPlayground,
  importFirebaseInitializer
} from './module-manager.js';

let toast;
let testId;
let GARelay;
let appUser;
let provider;
let uiIsBuilt = false;
const activeAssessments = {};

dotenv.config();

const testsListEl = select('#tests-list');
const invalidURLMsg = 'Awwww Snaaap :( Your Assesment URL Is Invalid.';
const testNotYetOpenMsg = `I see you're an early bird. However, this assessment is not yet open.`;
const unableToLoadMsg = 'Unable to load your assessment, please retry.';
const busyCriticalMsg = 'Busy. Loading Critical Assets. Please Wait ...';

const notify = msg => {
  if (!toast || trim(msg) === '') return;

  select('#intro-toast .mdc-snackbar__label').textContent = msg;
  toast.open();
};

const signIn = () => {
  if (!provider) return;

  firebase
    .auth()
    .signInWithPopup(provider)
    .catch(error => {
      const { code, message } = error;
      if (code && code.indexOf('account-exists-with-different-credential') !== -1) {
        notify(
          'Make sure you are using the intended Github account. An account already exists with the same email address but different sign-in credentials.'
        );
      } else if (code && code.indexOf('network-request-failed') !== -1) {
        notify('Potential network error. Please refresh and try again!');
      } else {
        notify(`${message}`);
      }

      GARelay.ga('send', {
        hitType: 'event',
        nonInteraction: true,
        eventAction: `${code}`,
        eventLabel: `${message}`,
        eventCategory: 'Playground'
      });
    });
};

const setupSignIn = () => {
  if (uiIsBuilt === true) return;

  const signInBtn = select(`[data-view='home'] button`);
  if (signInBtn) {
    signInBtn.addEventListener('click', signIn);
    signInBtn.classList.add('live');
  }
  uiIsBuilt = true;
};

const fetchImpliedAssessment = () => {
  try {
    notify('Still busy, please wait ...');
    const assessmentId = testId
      .split('')
      .reverse()
      .join('');

    return firebase
      .firestore()
      .collection('assessments')
      .doc(assessmentId)
      .get();
  } catch (error) {
    console.log(error);
  }
};

const assessmentIsLive = assessmentDoc => {
  const { startingAt } = assessmentDoc.data();
  if (isAfterKickoffTime({ startingAt })) return true;

  const msg = `${testNotYetOpenMsg} Do check back on ${new Date(startingAt)}`;
  notify(testNotYetOpenMsg);
  select(`[data-view='intro'] h3.mdc-typography--headline5`).textContent = msg;

  return false;
};

const enterPlayground = async assessmentDoc => {
  notify('Busy, loading playground resources  ...');

  const playground = await importPlayground();
  playground.enter({ user: appUser, test: testId, assessmentDoc });
};

const enterHome = () => {
  goTo('home', { test: testId });
};

const initServiceBot = () => loadStylesAndScripts('/engines/service-bot.js');

const bootstrapAssessment = async user => {
  appUser = user;
  let assessmentDoc;

  try {
    assessmentDoc = await fetchImpliedAssessment();
  } catch (error) {
    notify(unableToLoadMsg);
    console.warn(error.message);

    GARelay.ga('send', {
      hitType: 'event',
      nonInteraction: true,
      eventCategory: 'Playground',
      eventLabel: `${error.message}`,
      eventAction: 'fetch-implied-assessment'
    });
  }

  if(!assessmentDoc || !assessmentDoc.exists) {
    notify(unableToLoadMsg);
    return;
  }

  if (!assessmentIsLive(assessmentDoc)) return;

  await enterPlayground(assessmentDoc);
};

/**
 * @description handles the github authentication
 * and redirects to the requried view
 * 
 * @param {string} nextView 
 */
const setupAuthentication = async (nextView) => {
  provider = await new firebase.auth.GithubAuthProvider();
  provider.setCustomParameters({
    allow_signup: 'false'
  });

  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      enterHome(testId);
      setupSignIn();

      GARelay.ga('send', {
        hitType: 'event',
        nonInteraction: true,
        eventCategory: 'Playground',
        eventAction: 'setup-signin'
      });

      return;
    }
    appUser = user;
    if (nextView === 'assessments') {
      goTo('assessments', {}, '!#assessments');
    } else {
      goTo('intro', { test: testId });
      bootstrapAssessment(user);
      GARelay.ga('set', 'userId', `${user.email}`);
    }
  });
};

/**
 * @description handles the click on an assessment card
 * and changes the view to playground
 * 
 * @param {object} event 
 */
const moveToPlayground = event => {
  const itemEl = event.target.closest('.mdc-card');
  if (!itemEl) return;

  const id = itemEl.getAttribute('data-key');
  if (!id) {
    notify(unableToLoadMsg);
    return;
  };

  testId = id;
  enterPlayground(activeAssessments[id]);
}

/**
 * @description creates the assessments card for the assessment view
 * 
 * @param {object} assessment 
 */
const testsListItemTPL = assessment => ( html`
    ${
      assessment.map(
      item => html`
        <div class="mdc-layout-grid__cell mdc-layout-grid__cell--span-2">
          <div
            class="mdc-card text-only spec-card"
            data-key=${item.id}
            @click=${moveToPlayground}
          >
            <div class="mdc-card__primary-action" tabindex="0">
              <h2 class="mdc-typography--headline6">
                ${item.name} ${item.cycle}
              </h2>
              <div class="mdc-typography--body2"></div>
            </div>
          </div>
        </div>
      `
    )}
  `)

/**
 * @description loads the assessments from firebase
 * and builds the UI for the assessments view
 */
const userWillViewTests = async () => {
  notify(busyCriticalMsg);
  const fb = await importFirebaseInitializer();

  await fb.init();

  setupAuthentication('assessments');

  notify('Fetching assessments');
  const ASSESSMENTS = firebase.firestore().collection('assessments');

  ASSESSMENTS.get()
    .then(snapshot => {
      const tests = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const { status, endingAt } = data;
        if (status !== 'archived' && isWithinDeadline({ endingAt })) {
          tests.push({
            id: doc.id,
            ...data
          });
          // store the assessments in an object using the id as key
          activeAssessments[doc.id] = doc;
        }
        render(testsListItemTPL(tests), testsListEl);
      });
    })
    .catch((error) => console.warn(error));

  [...selectAll('.mdc-chip-set')].forEach(chip => {
    mdc.chips.MDCChip.attachTo(chip);
  });

  notify('DONE!');
};

const enterAssessments = () => {
  select('body').setAttribute('data-auth', 'authenticated');
  userWillViewTests();
  mdc.topAppBar.MDCTopAppBar.attachTo(select('.mdc-top-app-bar'));
};


const takeOff = async () => {
  // get the serverTime right now and 
  // uodate it after every 1 hour
  global.serverTime = await getServerTime();
  const serverPingInterval = 1000 * 60 * 60;
  rAF({wait: serverPingInterval}).then(async () => {
    global.serverTime = await getServerTime();
  });

  await importGARelay().then(module => {
    GARelay = module.default;
  });

  handleWindowPopState();
  toast = mdc.snackbar.MDCSnackbar.attachTo(select('#intro-toast'));
  const { pathname } = window.location;

  if (pathname === '/' || pathname === '/!') {
    enterAssessments();
    return;
  }

  const matches = pathname.match(/\/(.+)/);
  if (matches && matches[1]) {
    testId = matches[1].replace(/\/?!?$/, '');

    if (!testId) {
      notify(invalidURLMsg);
      enterAssessments();
      return;
    }
    enterHome();


    notify(busyCriticalMsg);
    const fb = await importFirebaseInitializer();
  
    notify('Busy, please wait ...');
    await fb.init();
  

    GARelay.tryResend();
    setupAuthentication();

    if(navigator.serviceWorker) {
      if(process.env.NODE_ENV === 'development') {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach(registration => registration.unregister());
        });
      } else {
        const swURL = `${window.location.origin}/sw.js`;
        navigator.serviceWorker.register(swURL);
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', takeOff);
