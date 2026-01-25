interface QuestionProps {
    question?: string;
}

export function Question({ question }: QuestionProps) {
    return (
        <>
            <h2 className="subtitle is-4 mb-3">Current Question</h2>
            <div className="notification is-primary is-light mb-4">
                <p className="is-size-5 has-text-weight-semibold">{question}</p>
            </div>
        </>
    );
}
