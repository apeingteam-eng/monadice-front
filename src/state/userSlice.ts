import { createSlice } from "@reduxjs/toolkit";

type UserState = {
  address: string | null;
};

const initialState: UserState = {
  address: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {},
});

export default userSlice.reducer;




