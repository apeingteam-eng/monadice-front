import { createSlice } from "@reduxjs/toolkit";

type MarketState = {
  items: Array<{ id: string; title: string }>;
};

const initialState: MarketState = {
  items: [],
};

const marketSlice = createSlice({
  name: "market",
  initialState,
  reducers: {},
});

export default marketSlice.reducer;




