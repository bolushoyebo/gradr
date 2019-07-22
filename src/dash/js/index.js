import firebase from 'firebase/app';

import { trim, select, goTo, handleWindowPopState } from '../../commons/js/utils.js';

import {
  importDash,
  importFirebaseInitializer
} from './module-manager.js';

let provider;
let toast;
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
      console.warn(`${code} => ${message}`);
    });
};

const setupSignIn = () => {
  const signInBtn = select(`[data-view='home'] button`);
  if (signInBtn) {
    signInBtn.addEventListener('click', signIn);
  }
};

const takeOff = () => {
  
  handleWindowPopState();
  toast = mdc.snackbar.MDCSnackbar.attachTo(select('#intro-toast'));
  importFirebaseInitializer().then(fbInitializer => {
    notify('Busy, loading admin dashboard resources  ...');
    fbInitializer.init();

    // TODO switch to email/password  provider
    provider = new firebase.auth.GithubAuthProvider();
    provider.addScope('repo');
    provider.setCustomParameters({
      allow_signup: 'false'
    });

    firebase.auth().onAuthStateChanged(user => {
      if(user) {
        importDash().then(dash => {
          dash.enter(user);
        });
        return;
      }

      goTo('home');
      setupSignIn();
    });
  });
};

document.addEventListener('DOMContentLoaded', takeOff);