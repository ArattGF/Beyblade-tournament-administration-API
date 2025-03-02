const { Router } = require('express');

const {signInUser, createUser} = require('../Controller/AdminController');

const app = Router();

// Define your routes here
app.post('/signin', signInUser);

// app.post('/create', async (req, res) => {
//   try {
//     const newUser = new User(req.body);
//     await newUser.save();
//     res.send('User created');
//   } catch (error) {
//     res.status(500).send('Error creating user');
//   }
// });

// app.put('/update/:id', async (req, res) => {
//   try {
//     const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.send(`User with id ${req.params.id} updated`);
//   } catch (error) {
//     res.status(500).send('Error updating user');
//   }
// });

// app.delete('/delete/:id', async (req, res) => {
//   try {
//     await User.findByIdAndDelete(req.params.id);
//     res.send(`User with id ${req.params.id} deleted`);
//   } catch (error) {
//     res.status(500).send('Error deleting user');
//   }
// });

module.exports = app;