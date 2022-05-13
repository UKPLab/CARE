<template>
  <div class="form-group row my-2">
    <label for="first_name" class="col-md-4 col-form-label text-md-right">First name</label>
    <div class="col-md-6">
      <input type="text" id="first_name" class="form-control" name="first_name" required autofocus>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="last_name" class="col-md-4 col-form-label text-md-right">Last name</label>
    <div class="col-md-6">
      <input type="text" id="last_name" class="form-control" name="last_name" required autofocus>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="user_name" class="col-md-4 col-form-label text-md-right">Username</label>
    <div class="col-md-6">
      <input type="text" id="user_name" class="form-control" name="user_name" required autofocus>
    </div>
  </div>

   <div class="form-group row my-2">
    <label for="email" class="col-md-4 col-form-label text-md-right">E-Mail</label>
    <div class="col-md-6">
      <input type="text" id="email" class="form-control" name="email" required autofocus>
    </div>
  </div>

  <div class="form-group row my-2">
    <label for="password" class="col-md-4 col-form-label text-md-right">Password</label>
    <div class="col-md-6">
      <input type="password" id="password" class="form-control" name="password" required autofocus>
    </div>
  </div>

  <div class="form-group row my-2">
    <div class="col-md-6 offset-md-4">
      <label>
        <input type="checkbox" name="terms"> I accept the terms!
      </label>
    </div>
  </div>

  <div class="col-md-6 offset-md-4">
    <button type="button" class="btn btn-primary">Register</button>

  </div>

</template>

<script>
export default {
  name: "Register",
  methods: {
  }
}
</script>

<style scoped>

</style>