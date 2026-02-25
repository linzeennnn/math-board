import AuxBoard from "./page/auxBoard/auxBorad";
import MainBoard from "./page/mainBoard/mainBoard";
import Start from "./page/start"
import '@/css/index.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {

  return (
   <BrowserRouter>
   <Routes>
     <Route path="/" element={<Start />} />
     <Route path="/main" element={<MainBoard />} />
     <Route path="/aux" element={<AuxBoard />} />
   </Routes>
   </BrowserRouter>
  )
}

export default App
