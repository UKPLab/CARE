<template>
  <form class="row g-3 needs-validation" novalidate>
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            Register
            <a class="btn btn-sm btn-primary" href="#" @click="this.$router.push('/login')">Login</a>
          </div>

          <div class="card-body mx-4 my-4">

            <div v-if="requestName" class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="firstName">First name</label>
              <div class="col-md-6">
                <input id="firstName" v-model="firstName" autofocus class="form-control" name="firstName" required
                       type="text" @blur="setValidity" @input="setValidity">
                <div class="feedback-invalid">Please provide your first name.</div>
              </div>
            </div>


            <div v-if="requestName" class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="lastName">Last name</label>
              <div class="col-md-6">
                <input id="lastName" v-model="lastName" class="form-control" name="lastName" required type="text"
                       @blur="setValidity" @input="setValidity">
                <div class="feedback-invalid">Please provide your last name.</div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="userName">Username</label>
              <div class="col-md-6">
                <input id="userName" v-model="userName" class="form-control" name="userName" pattern="^[a-zA-Z0-9]+$"
                       required
                       type="text" @blur="setValidity" @input="setValidity">
                <div class="feedback-invalid">Please provide a valid username - no special characters.</div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="email">E-Mail</label>
              <div class="col-md-6">
                <input id="email" v-model="email" class="form-control" name="email" required type="email"
                       @blur="setValidity" @input="setValidity">
                <div class="feedback-invalid">Please provide a valid email address.</div>
              </div>
            </div>


            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="password">Password</label>
              <div class="col-md-6">
                <input id="password" v-model="password" class="form-control" name="password" pattern=".{8,}" required
                       type="password" @blur="setValidity"
                       @input="setValidity">
                <div class="feedback-invalid">Passwords must be at least 8 characters.</div>
              </div>
            </div>


            <div class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input v-model="acceptTerms" name="acceptTerms" type="checkbox" @input="setValidity" @blur="setValidity"> I accept the <a href="#"
                                                                                       v-on:click="this.$refs.terms.open()">terms</a>!
                  <div class="feedback-invalid">Please accept the terms.</div>

                </label>
              </div>
            </div>

            <div v-if="requestStats" class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input v-model="acceptStats" name="acceptStats" type="checkbox"> I allow the collection of anonymous statistics!
                </label>
              </div>
            </div>

            <div class="col-md-6 offset-md-4">
              <button class="btn btn-primary" type="submit" @click="trySubmit">Register</button>

            </div>
          </div>
        </div>
      </div>
    </div>
  </form>

  <TermsModal ref="terms"></TermsModal>
</template>

<script>
/* Register.vue - registration component

This component provides a basic mask to enter user information
and register a user on the server.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Carly Gettinger (cjgettinger@gmail.com)
Source: -
*/
import {mapActions} from "vuex";
import TermsModal from "./TermsModal.vue";

export default {
  name: "Register",
  components: {TermsModal},
  computed: {
    requestName() {
      return window.config['app.register.requestName'] === 'true';
    },
    requestStats() {
      return window.config['app.register.requestStats'] === 'true';
    },
  },
  data() {
    return {
      firstName: "",
      lastName: "",
      userName: "",
      email: "",
      password: "",
      acceptTerms: false,
      acceptStats: false,
    }
  },
  methods: {
    ...mapActions({register: "auth/register"}),
    trySubmit() {
      const form = document.querySelector('form');
      console.log(form);
      if (form.checkValidity()) {
        event.preventDefault();
        this.register_user();
      }
    },

    findNextSiblingWithClass(element, className) {
      var nextSibling = element.nextElementSibling;
      while(nextSibling != null) {
        if (nextSibling.classList.contains(className)) {
          return nextSibling;
        }
        nextSibling = nextSibling.nextElementSibling;
      }
    },

    setValidity() {
      const evtTarget = event.target;
      const targetName = evtTarget.getAttribute('name');
      var valid;
      const emailRegEx = new RegExp("^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$");
      const usernameRegEx = new RegExp("^[a-zA-Z0-9]+$");
      const feedbackDiv = this.findNextSiblingWithClass(evtTarget, "feedback-invalid");

      if (targetName == "email") {
        valid = emailRegEx.test(evtTarget.value);
      } else if (targetName == "password") {
        valid = (evtTarget.value.length >= 8);
      } else if (targetName == "acceptTerms") {
        valid = evtTarget.checked;
      } else if (targetName == "userName") {
        valid = (usernameRegEx.test(evtTarget.value) && (evtTarget.value != ""));
      } else {
        valid = (evtTarget.value != "");
      }
      if (valid) {
        evtTarget.classList.remove("custom-invalid");
        feedbackDiv.classList.remove("invalid");
      } else {
        if (event.type == 'input') {
          return;
        }
        evtTarget.classList.add("custom-invalid");
        feedbackDiv.classList.add("invalid");
      }
    },

    async register_user() {
      try {
        let response = await this.register({
          firstName: this.firstName,
          lastName: this.lastName,
          userName: this.userName,
          email: this.email,
          password: this.password,
          acceptTerms: this.acceptTerms,
          acceptStats: this.acceptStats,
        });

        if (response.statusText === "Created") {
          this.eventBus.emit('toast', {
            message: "The user registration was successful",
            title: "User Registration Complete",
            variant: 'success'
          });

          await this.$router.push("/login");
        }
      } catch (err) {
        this.eventBus.emit('toast', {
          message: err.response.data,
          title: "Invalid User Credentials",
          variant: 'danger'
        });
      }
    }
  }
}
</script>

<style scoped>
.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  visibility: hidden;
  padding-top: 4px;
}

.feedback-invalid.invalid {
  visibility: visible;
}

input.custom-invalid:not([type='checkbox']) {
  border:transparent;
  outline: 1px solid firebrick;
  border-radius: 1px;
}

input:focus.custom-invalid:not([type='checkbox']) {
  outline:none;
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
}

input:focus[type='password'] + .feedback-invalid {
  visibility: visible;
}

input:focus[type='password']:not(.custom-invalid) + .feedback-invalid {
  color: black;
}

</style>