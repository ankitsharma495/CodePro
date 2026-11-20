import "./CircularLoader.scss";

const CircularLoader = () => {
	return (
		<div className="loader-container">
			<div className="loader"></div>
			<p>Please wait, setting up the simulator</p>
		</div>
	);
};

export default CircularLoader;
