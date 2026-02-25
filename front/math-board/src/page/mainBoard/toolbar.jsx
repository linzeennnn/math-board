import '@/css/main.css'
import { useState } from 'react'
export default function Toolbar(){
    const [show,setShow]=useState(true)
    return(
        <>
   { show && <div id="tool-bar">

    </div>}
        <button
        id='set-tool-bar-btn'
        onClick={()=>setShow(!show)}>切换工具栏</button>
        </>
    )
}