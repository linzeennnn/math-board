import PaintBoard from "./paintBoard";
import Toolbar from "./toolbar";

export default function MainBoard() {
    return(
        <div id="main-page">
            <PaintBoard/>
            <Toolbar/>
        </div>
    )
}