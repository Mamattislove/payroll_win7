const Card = ({ children }) => {
    return (
        <div className="bg-white w-11/12 sm:w-96 p-8 sm:p-10 rounded-lg shadow-xl">
            {children}
        </div>
    );
};
export default Card;
