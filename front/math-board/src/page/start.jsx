import '@/css/start.css'
import { useNavigate } from "react-router-dom";
export default function Start(){
  const navigate = useNavigate();
    return(
        <div id="start-btn-box">
            <button className="start-btn"
            onClick={() => {navigate("/main")}}
            >进入主画板</button>
            <button className="start-btn" 
            onClick={() => {navigate("/aux")}}
            >进入辅助画板</button>
        </div>
    )
}