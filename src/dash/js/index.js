import firebase from 'firebase/app';
import dotenv from 'dotenv';
import getServerTime from '../../commons/js/getServerTime.js';

import { select, goTo, handleWindowPopState, rAF } from '../../commons/js/utils.js';

import {
  importFirebaseInitializer
} from './module-manager.js';

const importDash = () => import('./dashboard.js');

let provider;
dotenv.config();

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

const takeOff = async () => {
  // get the serverTime right now and 
  // uodate it after every 1 hour
  global.serverTime = await getServerTime();
  const serverPingInterval = 1000 * 60 * 60;
  rAF({wait: serverPingInterval}).then(async () => {
    global.serverTime = await getServerTime();
  });

  handleWindowPopState();
  importFirebaseInitializer().then(fbInitializer => {
    fbInitializer.init();

    // TODO switch to email/password  provider
    provider = new firebase.auth.GithubAuthProvider();
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