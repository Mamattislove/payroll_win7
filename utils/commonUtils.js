export const filterEmptyFields = (obj) =>
    Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            acc[key] = value;
        }
        return acc;
    }, {});
