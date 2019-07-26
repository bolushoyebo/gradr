import { trim, select } from '../../commons/js/utils.js';

export const notify = msg => {
  if (!msg || msg === '') return;

  let toast;
  const message = trim(msg);
  const toastr = select('#toast');
  if (!toast) toast = mdc.snackbar.MDCSnackbar.attachTo(toastr);

  toastr.querySelector('.mdc-snackbar__label').textContent = message;
  toast.open();
};
