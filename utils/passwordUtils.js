import bcryptjs from "bcryptjs";

export async function hashedPassword(password) {
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);
    return hashedPassword;
}

export async function comparePassword(password, hashedPassword) {
    const isMatch = await bcryptjs.compare(password, hashedPassword);
    return isMatch;
}
