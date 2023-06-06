<template>
  <form
      ref="registerForm"
      class="row g-3 needs-validation"
      novalidate
      @submit.prevent="checkForm"
  >
    <div class="col-md-8 mx-auto my-4">
      <div class="col-md-8 mx-auto">
        <div
            class="text-center"
            style="margin-bottom: 20px"
        >
          <IconAsset
              name="logo"
              :height="200"
          />
        </div>

        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            Register
            <a
                class="btn btn-sm btn-primary"
                href="#"
                @click="$router.push('/login')"
            >Login</a>
          </div>

          <div class="card-body mx-4 my-4">
            <div
                v-if="requestName"
                class="form-group row my-2"
            >
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="firstName"
              >First name</label>
              <div class="col-md-6">
                <input
                    id="firstName"
                    v-model="formData['firstName']"
                    autofocus
                    class="form-control"
                    name="firstName"
                    required
                    type="text"
                >
                <div class="feedback-invalid">
                  Please provide your first name.
                </div>
              </div>
            </div>


            <div
                v-if="requestName"
                class="form-group row my-2"
            >
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="lastName"
              >Last name</label>
              <div class="col-md-6">
                <input
                    id="lastName"
                    v-model="formData['lastName']"
                    class="form-control"
                    name="lastName"
                    required
                    type="text"
                >
                <div class="feedback-invalid">
                  Please provide your last name.
                </div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="userName"
              >Username</label>
              <div class="col-md-6">
                <input
                    id="userName"
                    v-model="formData['userName']"
                    class="form-control"
                    name="userName"
                    pattern="^[a-zA-Z0-9]+$"
                    required
                    type="text"
                    @blur="checkVal('userName')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['userName'] && !validUsername}">
                  Please provide a valid username - no special characters.
                </div>
              </div>
            </div>

            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="email"
              >E-Mail</label>
              <div class="col-md-6">
                <input
                    id="email"
                    v-model="formData['email']"
                    class="form-control"
                    name="email"
                    required
                    type="email"
                    @blur="checkVal('email')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['email'] && !validEmail}">
                  Please provide a valid email address.
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <label
                  class="col-md-4 col-form-label text-md-right"
                  for="password"
              >Password</label>
              <div class="col-md-6">
                <input
                    id="password"
                    v-model="formData['password']"
                    class="form-control"
                    name="password"
                    pattern=".{8,}"
                    required
                    type="password"
                    @blur="checkVal('password')"
                >
                <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                  Passwords must be at least 8 characters.
                </div>
              </div>
            </div>


            <div class="form-group row my-2">
              <div class="col-md-6 offset-md-4">
                <label>
                  <input
                      v-model="formData['acceptTerms']"
                      name="acceptTerms"
                      type="checkbox"
                      @blur="checkVal('acceptTerms')"
                  > I accept the <a
                    href="#"
                    @click="$refs.terms.open()"
                >terms</a>!
                  <div class="feedback-invalid" :class="{invalid: validity['acceptTerms'] && !validTerms}">Please accept
                    the terms.
                  </div>

                </label>
              </div>
            </div>

            <div
                v-if="requestStats"
                class="form-group row my-2"
            >
              <div class="col-md-6 offset-md-4">
                <label>
                  <input
                      v-model="formData['acceptStats']"
                      name="acceptStats"
                      type="checkbox"
                  > I allow the collection of anonymous statistics!
                </label>
              </div>
            </div>

            <div class="col-md-6 offset-md-4">
              <button
                  class="btn btn-primary"
                  type="submit"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
  <TermsModal ref="terms"/>
</template>

<script>
/**
 *  Registration component
 *
 *  This component provides a basic mask to enter user information
 *  and register a user on the server.
 *
 *  @Author: Dennis Zyska, Carly Gettinger
 */
import TermsModal from "./TermsModal.vue";
import IconAsset from "@/icons/IconAsset.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "AuthRegister",
  components: {TermsModal, IconAsset},
  data() {
    return {
      formData: {
        firstName: "",
        lastName: "",
        userName: "",
        email: "",
        password: "",
        acceptTerms: false,
        acceptStats: false,
      },
      validity: null
    }
  },
  computed: {
    requestName() {
      return window.config['app.register.requestName'] === 'true';
    },
    requestStats() {
      return window.config['app.register.requestStats'] === 'true';
    },
    validEmail() {
      const emailRegEx = new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
      return emailRegEx.test(this.formData.email);
    },
    validUsername() {
      const usernameRegEx = new RegExp("^[a-zA-Z0-9]+$");
      return usernameRegEx.test(this.formData.userName);
    },
    validPassword() {
      return this.formData.password.length >= 8;
    },
    validTerms() {
      return this.formData.acceptTerms;
    },
    validForm() {
      return this.validEmail && this.validUsername && this.validPassword && this.validTerms;
    }
  },
  beforeMount() {
    this.validity = Object.fromEntries(Object.keys(this.formData).map(key => [key, false]));
  },
  methods: {
    checkVal(key) {
      this.validity[key] = true;
    },
    async checkForm() {
      Object.keys(this.validity).map(key => {
        this.validity[key] = true
      })
      if (this.validForm) {
        await this.registerUser();
      }
    },
    async registerUser() {
      try {
        await axios.post(getServerURL() + '/auth/register', this.formData, {
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        });

        this.eventBus.emit('toast', {
          message: "The user registration was successful",
          title: "User Registration Complete",
          variant: 'success'
        });

        await this.$router.push("/login");
      } catch (err) {
        this.eventBus.emit('toast', {
          message: err.message,
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

input:focus[type='password'] + .feedback-invalid {
  visibility: visible;
}

input:focus[type='password']:not(.custom-invalid) + .feedback-invalid {
  color: black;
}

</style>